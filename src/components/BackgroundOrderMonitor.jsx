
import { useEffect, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  Timestamp
} from "firebase/firestore";
import { db } from "../firebase";

const PAYMENT_API_URL =
  import.meta.env.VITE_PAYMENT_API_URL || "";

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return null;
}

function isWaiting(order) {
  return (
    String(order?.status || "").toUpperCase() ===
    "WAITING_FOR_CONFIRMATION"
  );
}

function orderLabel(order) {
  return (
    order.orderNumber ||
    order.orderNo ||
    order.orderId ||
    order.id?.slice(-8).toUpperCase() ||
    "—"
  );
}

async function notifyCustomer(order, status) {
  if (!order?.customerId) return;

  try {
    await fetch(
      `${PAYMENT_API_URL}/api/notifications/order-status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerId: String(order.customerId),
          orderId: String(order.id || ""),
          orderNumber: String(orderLabel(order)),
          status,
          orderType: String(order.orderType || "Delivery")
        })
      }
    );
  } catch (error) {
    console.error("Customer notification failed:", error);
  }
}

export default function BackgroundOrderMonitor() {
  const ordersRef = useRef([]);
  const handlingRef = useRef(new Set());

  useEffect(() => {
    // Run only inside the Electron desktop app.
    const electron = window.electronAPI;

    if (
      !electron ||
      typeof electron.notifyNewOrder !== "function" ||
      typeof electron.onBackgroundOrderAction !== "function"
    ) {
      return;
    }

    let firstSnapshot = true;
    const knownIds = new Set();

    const unsubscribeOrders = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        const orders = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        ordersRef.current = orders;

        if (firstSnapshot) {
          firstSnapshot = false;

          // Show an existing unexpired waiting order after app restart.
          const pending = orders.find(
            (order) =>
              isWaiting(order) &&
              toMillis(order.confirmationDeadline) > Date.now()
          );

          if (pending) {
            electron.notifyNewOrder({
              id: pending.id,
              orderNumber: orderLabel(pending),
              customerName:
                pending.customerName || pending.name || "Customer",
              total: Number(pending.total || 0),
              orderType: pending.orderType || "Delivery",
              confirmationDeadline:
                toMillis(pending.confirmationDeadline)
            });
          }

          orders.forEach((order) => knownIds.add(order.id));
          return;
        }

        snapshot.docChanges().forEach((change) => {
          const order = {
            id: change.doc.id,
            ...change.doc.data()
          };

          if (change.type !== "added") return;
          if (knownIds.has(order.id)) return;

          knownIds.add(order.id);

          if (!isWaiting(order)) return;

          electron.notifyNewOrder({
            id: order.id,
            orderNumber: orderLabel(order),
            customerName:
              order.customerName || order.name || "Customer",
            total: Number(order.total || 0),
            orderType: order.orderType || "Delivery",
            confirmationDeadline:
              toMillis(order.confirmationDeadline)
          });
        });
      },
      (error) => {
        console.error(
          "Background order listener failed:",
          error
        );
      }
    );

    const unsubscribeActions =
      electron.onBackgroundOrderAction(
        async ({ orderId, action } = {}) => {
          if (
            !orderId ||
            !["accept", "reject"].includes(action) ||
            handlingRef.current.has(orderId)
          ) {
            return;
          }

          handlingRef.current.add(orderId);

          try {
            const orderRef = doc(db, "orders", orderId);

            const result = await runTransaction(
              db,
              async (transaction) => {
                const snap = await transaction.get(orderRef);

                if (!snap.exists()) {
                  return { outcome: "missing" };
                }

                const current = {
                  id: snap.id,
                  ...snap.data()
                };

                if (!isWaiting(current)) {
                  return { outcome: "handled" };
                }

                const deadline =
                  toMillis(current.confirmationDeadline);

                if (!deadline || Date.now() >= deadline) {
                  transaction.update(orderRef, {
                    status: "CANCELLED",
                    confirmationStatus: "AUTO_CANCELLED",
                    cancelledAt: Timestamp.now(),
                    cancellationReason:
                      "Store did not confirm the order within 60 seconds",
                    acceptedAt: null,
                    preparationStartedAt: null,
                    preparationEndAt: null
                  });

                  return {
                    outcome: "expired",
                    order: current
                  };
                }

                if (action === "reject") {
                  transaction.update(orderRef, {
                    status: "Rejected",
                    confirmationStatus: "REJECTED",
                    rejectionReason: "Order rejected by staff",
                    rejectedAt: Timestamp.now(),
                    acceptedAt: null,
                    preparationStartedAt: null,
                    preparationEndAt: null
                  });

                  return {
                    outcome: "rejected",
                    order: current
                  };
                }

                const minutes = Number(
                  current.preparationMinutes ?? 15
                );
                const started = Date.now();
                const end = started + minutes * 60000;

                transaction.update(orderRef, {
                  status: "Preparing",
                  confirmationStatus: "ACCEPTED",
                  acceptedAt: Timestamp.fromMillis(started),
                  rejectedAt: null,
                  cancelledAt: null,
                  cancellationReason: "",
                  rejectionReason: "",
                  preparationStartedAt:
                    Timestamp.fromMillis(started),
                  preparationEndAt:
                    Timestamp.fromMillis(end),
                  preparationMinutes: minutes,
                  foodReadyAt: null,
                  dispatchedAt: null,
                  deliveredAt: null
                });

                return {
                  outcome: "accepted",
                  order: current,
                  minutes,
                  started,
                  end
                };
              }
            );

            if (
              result.outcome === "missing" ||
              result.outcome === "handled"
            ) {
              console.warn(
                "Popup action ignored:",
                result.outcome,
                orderId
              );
              return;
            }

            if (result.outcome === "expired") {
              await notifyCustomer(result.order, "CANCELLED");
              return;
            }

            if (result.outcome === "rejected") {
              await notifyCustomer(result.order, "REJECTED");
              return;
            }

            if (result.outcome === "accepted") {
              const order = result.order;

              await notifyCustomer(order, "CONFIRMED");

              // Print KOT only after successful acceptance.
              if (typeof electron.printKOT === "function") {
                const printPayload = {
                  ...order,
                  status: "Preparing",
                  confirmationStatus: "ACCEPTED",
                  acceptedAt:
                    Timestamp.fromMillis(result.started),
                  preparationStartedAt:
                    Timestamp.fromMillis(result.started),
                  preparationEndAt:
                    Timestamp.fromMillis(result.end),
                  preparationMinutes: result.minutes
                };

                let printed = false;

                for (let attempt = 0; attempt < 3; attempt++) {
                  try {
                    const printResult =
                      await electron.printKOT(printPayload);

                    if (printResult?.success) {
                      printed = true;
                      break;
                    }
                  } catch (error) {
                    console.error("KOT print attempt failed:", error);
                  }

                  if (attempt < 2) {
                    await new Promise((resolve) =>
                      setTimeout(resolve, 1000)
                    );
                  }
                }

                if (!printed) {
                  console.error(
                    "Order accepted, but KOT printing failed."
                  );
                }
              }
            }
          } catch (error) {
            console.error(
              "Background Accept/Reject failed:",
              error
            );
          } finally {
            handlingRef.current.delete(orderId);
          }
        }
      );

    return () => {
      unsubscribeOrders();
      if (typeof unsubscribeActions === "function") {
        unsubscribeActions();
      }
    };
  }, []);

  return null;
}
