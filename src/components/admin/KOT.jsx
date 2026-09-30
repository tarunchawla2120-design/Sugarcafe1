import { useEffect, useRef, useState } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import "./KOT.css";

/* =========================================================
   HELPERS
========================================================= */

const toMillis = (value) => {
  if (!value) return null;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const n = new Date(value).getTime();

  return Number.isNaN(n) ? null : n;
};

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

/* =========================================================
   DAILY SCRATCH REWARD
========================================================= */

const getDailyScratchReward = (order) => {
  return order?.dailyScratchReward || null;
};

const isFreeFoodReward = (reward) => {
  if (!reward?.enabled) {
    return false;
  }

  return (
    reward.type === "free_menu_item" ||
    reward.type === "free_item"
  );
};

const getRewardItemName = (reward) => {
  if (!reward) {
    return "";
  }

  return (
    reward.itemName ||
    reward.title ||
    reward.name ||
    ""
  );
};

/* =========================================================
   ITEMS
========================================================= */

/*
 * IMPORTANT:
 *
 * Normal items come from order.items / order.cart.
 *
 * If Daily Scratch gave a FREE FOOD ITEM and Checkout
 * did not physically add it into order.items, we add a
 * temporary FREE item here for Dashboard/KOT display.
 *
 * This does NOT modify Firestore.
 */

const itemsFor = (order) => {
  const sourceItems = Array.isArray(order?.items)
    ? order.items
    : Array.isArray(order?.cart)
    ? order.cart
    : [];

  const items = [...sourceItems];

  const reward = getDailyScratchReward(order);

  if (isFreeFoodReward(reward)) {
    const rewardName =
      getRewardItemName(reward);

    if (rewardName) {
      const normalizedRewardName =
        String(rewardName)
          .trim()
          .toLowerCase();

      const alreadyExists = items.some(
        (item) => {
          const itemName =
            item?.name ||
            item?.productName ||
            "";

          return (
            item?.isFreeReward === true &&
            String(itemName)
              .trim()
              .toLowerCase() ===
              normalizedRewardName
          );
        }
      );

      if (!alreadyExists) {
        items.push({
          id:
            reward.id ||
            `daily-scratch-${normalizedRewardName
              .replace(/\s+/g, "-")
              .replace(/[^a-z0-9-_]/gi, "")}`,

          name: rewardName,

          price: 0,

          qty: Number(
            reward.quantity ||
            reward.qty ||
            1
          ),

          quantity: Number(
            reward.quantity ||
            reward.qty ||
            1
          ),

          isFreeReward: true,

          dailyScratchReward: true,

          rewardType:
            "daily_scratch"
        });
      }
    }
  }

  return items;
};

/* =========================================================
   ORDER LABEL
========================================================= */

const label = (order) =>
  order?.orderNumber ||
  order?.orderNo ||
  order?.orderId ||
  order?.id
    ?.slice(-8)
    ?.toUpperCase() ||
  "—";

/* =========================================================
   KOT
========================================================= */

export default function KOT({
  order,
  onClose
}) {
  const [now, setNow] =
    useState(Date.now());

  const [saving, setSaving] =
    useState(false);

  const alarmRef =
    useRef(null);

  /* =======================================================
     CLOCK
  ======================================================= */

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(id);
    };
  }, []);

  /* =======================================================
     NO ORDER
  ======================================================= */

  if (!order) {
    return null;
  }

  /* =======================================================
     ORDER DATA
  ======================================================= */

  const status =
    order.status || "New";

  const items =
    itemsFor(order);

  const end =
    toMillis(
      order.preparationEndAt
    );

  const remainingSeconds =
    end
      ? Math.max(
          0,
          Math.floor(
            (end - now) / 1000
          )
        )
      : 0;

  const timeLeft =
    `${String(
      Math.floor(
        remainingSeconds / 60
      )
    ).padStart(2, "0")}:${String(
      remainingSeconds % 60
    ).padStart(2, "0")}`;

  const created =
    toMillis(
      order.createdAt
    );

  const orderDate =
    created
      ? new Date(created)
      : new Date();

  /* =======================================================
     PAYMENT
  ======================================================= */

  const paymentMethod =
    String(
      order.paymentMethod ||
      order.paymentStatus ||
      "Cash on Delivery"
    );

  const isPrepaid =
    /prepaid|online|upi|paid/i.test(
      paymentMethod
    ) ||
    order.paymentStatus ===
      "Paid";

  const paymentLabel =
    isPrepaid
      ? "PREPAID / ONLINE PAID"
      : "CASH ON DELIVERY";

  /* =======================================================
     ADDRESS
  ======================================================= */

  const address =
    typeof order.address ===
    "string"
      ? order.address
      : order.address?.fullAddress ||
        order.address?.address ||
        [
          order.address?.houseNo,
          order.address?.area,
          order.address?.locality,
          order.address?.landmark,
          order.address?.city,
          order.address?.state,
          order.address?.pincode
        ]
          .filter(Boolean)
          .join(", ") ||
        order.deliveryAddress ||
        order.customerAddress ||
        "—";

  /* =======================================================
     DAILY SCRATCH
  ======================================================= */

  const dailyScratchReward =
    getDailyScratchReward(order);

  const hasFreeReward =
    isFreeFoodReward(
      dailyScratchReward
    );

  const freeRewardName =
    getRewardItemName(
      dailyScratchReward
    );

  /* =======================================================
     BELL
  ======================================================= */

  const playBell = () => {
    try {
      if (!alarmRef.current) {
        alarmRef.current =
          new Audio(
            "/alarm_bell.mp3"
          );
      }

      alarmRef.current.currentTime =
        0;

      alarmRef.current
        .play()
        .catch(() => {});
    } catch (_) {}
  };

  /* =======================================================
     UPDATE ORDER
  ======================================================= */

  const updateOrder = async (
    updates
  ) => {
    setSaving(true);

    try {
      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        updates
      );

      return true;
    } catch (error) {
      console.error(
        "KOT order update failed:",
        error
      );

      alert(
        "Order update nahi ho paya."
      );

      return false;
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     PRINT KOT
  ======================================================= */

  const printKOT = async (
    printableOrder = order
  ) => {
    if (
      !window.electronAPI?.printKOT
    ) {
      alert(
        "Automatic KOT printing ke liye SugarCafe Dashboard app open karein.\n\n" +
        "Chrome browser se silent printing possible nahi hai."
      );

      return false;
    }

    try {
      const result =
        await window.electronAPI.printKOT(
          printableOrder
        );

      if (!result?.success) {
        console.error(
          "KOT print failed:",
          result?.failureReason
        );

        alert(
          `KOT print nahi hua.\n\n${
            result?.failureReason ||
            "Printer check karein."
          }`
        );
      }

      return Boolean(
        result?.success
      );
    } catch (error) {
      console.error(
        "KOT print error:",
        error
      );

      alert(
        "KOT print nahi hua.\n\nPrinter check karein."
      );

      return false;
    }
  };

  /* =======================================================
     ACCEPT ORDER
  ======================================================= */

  const acceptOrder =
    async () => {
      const minutes =
        Math.max(
          1,
          Number(
            order.preparationMinutes ??
            15
          )
        );

      const started =
        Date.now();

      const finish =
        started +
        minutes * 60000;

      const ok =
        await updateOrder({
          status:
            "Preparing",

          acceptedAt:
            Timestamp.fromMillis(
              started
            ),

          preparationStartedAt:
            Timestamp.fromMillis(
              started
            ),

          preparationEndAt:
            Timestamp.fromMillis(
              finish
            ),

          preparationMinutes:
            minutes,

          rejectedAt:
            null
        });

      if (!ok) {
        return;
      }

      /*
       * Build complete printable order.
       *
       * itemsFor() ensures the FREE Daily Scratch
       * reward is also available to Electron printer.
       */

      const printableItems =
        itemsFor(order);

      const printableOrder = {
        ...order,

        status:
          "Preparing",

        acceptedAt: {
          seconds:
            Math.floor(
              started / 1000
            )
        },

        preparationStartedAt: {
          seconds:
            Math.floor(
              started / 1000
            )
        },

        preparationEndAt: {
          seconds:
            Math.floor(
              finish / 1000
            )
        },

        preparationMinutes:
          minutes,

        items:
          printableItems
      };

      await printKOT(
        printableOrder
      );

      onClose?.();
    };

  /* =======================================================
     REJECT ORDER
  ======================================================= */

  const rejectOrder =
    async () => {
      const reason =
        window.prompt(
          "Reject reason (optional):",
          "Unable to accept this order"
        );

      const ok =
        await updateOrder({
          status:
            "Rejected",

          rejectionReason:
            reason ||
            "Order rejected by staff",

          rejectedAt:
            Timestamp.now()
        });

      if (ok) {
        onClose?.();
      }
    };

  /* =======================================================
     EXTRA TIME
  ======================================================= */

  const addExtraTime =
    () => {
      const mins =
        Math.max(
          1,
          Number(
            order.extraPreparationMinutes ??
            10
          )
        );

      const base =
        toMillis(
          order.preparationEndAt
        ) || now;

      return updateOrder({
        preparationEndAt:
          Timestamp.fromMillis(
            base +
              mins * 60000
          ),

        extraTimeAdded:
          mins
      });
    };

  /* =======================================================
     STATUS ACTIONS
  ======================================================= */

  const markFoodReady =
    () =>
      updateOrder({
        status:
          "Food Ready",

        foodReadyAt:
          Timestamp.now()
      });

  const dispatchOrder =
    () =>
      updateOrder({
        status:
          "Dispatched",

        dispatchedAt:
          Timestamp.now()
      });

  const markDelivered =
    () =>
      updateOrder({
        status:
          "Delivered",

        deliveredAt:
          Timestamp.now()
      });

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      className="kot-overlay"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <div className="kot-box">

        {/* =================================================
            NEW ORDER ACTIONS
        ================================================= */}

        {status === "New" && (
          <div className="kot-response">

            <strong>
              ⏱️ NEW ORDER
            </strong>

            <button
              onClick={
                acceptOrder
              }
              disabled={saving}
            >
              ✅ ACCEPT ORDER
            </button>

            <button
              onClick={
                rejectOrder
              }
              disabled={saving}
            >
              ❌ REJECT
            </button>

          </div>
        )}

        {/* =================================================
            EXTRA TIME
        ================================================= */}

        {status ===
          "Preparing" && (
          <button
            className="extra-time-btn"
            onClick={
              addExtraTime
            }
            disabled={saving}
          >
            ➕ +10 MIN EXTRA
          </button>
        )}

        {/* =================================================
            KITCHEN SLIP
        ================================================= */}

        <section className="print-slip kitchen-slip">

          <div className="kot-header">
            <h2>
              SUGAR CAFE
            </h2>

            <p>
              KITCHEN ORDER TICKET
            </p>
          </div>

          <div className="kot-line" />

          <div className="kot-info">

            <p>
              <strong>
                Order:
              </strong>{" "}
              #{label(order)}
            </p>

            <p>
              <strong>
                Date:
              </strong>{" "}
              {orderDate.toLocaleDateString(
                "en-IN"
              )}
            </p>

            <p>
              <strong>
                Time:
              </strong>{" "}
              {orderDate.toLocaleTimeString(
                "en-IN",
                {
                  hour:
                    "2-digit",
                  minute:
                    "2-digit"
                }
              )}
            </p>

            <p>
              <strong>
                Type:
              </strong>{" "}
              {order.orderType ||
                "Delivery"}
            </p>

          </div>

          <div className="kot-line" />

          <h3>
            ORDER ITEMS
          </h3>

          {/* =================================================
              ORDER ITEMS
          ================================================= */}

          <div className="kot-items">

            {items.length ? (
              items.map(
                (
                  item,
                  index
                ) => {

                  const qty =
                    Number(
                      item.qty ||
                      item.quantity ||
                      1
                    );

                  const itemName =
                    item.name ||
                    item.productName ||
                    "Food Item";

                  const isFree =
                    item.isFreeReward ===
                      true ||
                    item.dailyScratchReward ===
                      true;

                  return (
                    <div
                      className={`kot-item ${
                        isFree
                          ? "kot-free-reward-item"
                          : ""
                      }`}
                      key={
                        item.id ||
                        index
                      }
                    >

                      <div className="kot-item-name">

                        <strong>

                          {isFree &&
                            "🎁 "}

                          {isFree
                            ? `FREE ${itemName}`
                            : itemName}

                        </strong>

                        {item.variant && (
                          <small>
                            {
                              item.variant
                            }
                          </small>
                        )}

                      </div>

                      <div className="kot-item-qty">
                        × {qty}
                      </div>

                    </div>
                  );
                }
              )
            ) : (
              <p>
                No items found.
              </p>
            )}

          </div>

          {/* =================================================
              REWARD INFORMATION
          ================================================= */}

          {hasFreeReward &&
            freeRewardName && (
              <>
                <div
                  className="kot-line"
                />

                <div
                  className="kot-reward-note"
                  style={{
                    padding:
                      "8px 10px",
                    margin:
                      "8px 0",
                    border:
                      "1px solid #fed7aa",
                    borderRadius:
                      8,
                    background:
                      "#fff7ed",
                    color:
                      "#9a3412",
                    fontWeight:
                      800,
                    fontSize:
                      13
                  }}
                >
                  🎁 DAILY SCRATCH
                  REWARD
                  <br />

                  <span
                    style={{
                      fontWeight:
                        700
                    }}
                  >
                    FREE{" "}
                    {
                      freeRewardName
                    }
                  </span>
                </div>
              </>
            )}

          {/* =================================================
              CUSTOMER NOTES
          ================================================= */}

          {(
            order.instructions ||
            order.customerNotes ||
            order.notes
          ) && (
            <>
              <div
                className="kot-line"
              />

              <h3>
                CUSTOMER NOTES
              </h3>

              <p className="kot-instructions">
                {order.instructions ||
                  order.customerNotes ||
                  order.notes}
              </p>
            </>
          )}

          <div className="kot-line" />

          {/* =================================================
              PAYMENT
          ================================================= */}

          <p>
            <strong>
              Payment:
            </strong>{" "}
            {paymentLabel}
          </p>

          <p>
            <strong>
              Total:
            </strong>{" "}
            {money(order.total)}
          </p>

          <p>
            <strong>
              Prepare By:
            </strong>{" "}
            {end
              ? new Date(
                  end
                ).toLocaleString(
                  "en-IN"
                )
              : "After acceptance"}
          </p>

          <div className="kot-line" />

          <span
            className={`kot-status status-${status
              .toLowerCase()
              .replace(
                /\s+/g,
                "-"
              )}`}
          >
            {status}
          </span>

        </section>

        {/* =================================================
            DELIVERY SLIP
        ================================================= */}

        <section className="print-slip delivery-slip">

          <div className="kot-header">

            <h2>
              SUGAR CAFE
            </h2>

            <p>
              DELIVERY PARTNER HANDOVER
            </p>

          </div>

          <div className="kot-line" />

          <div className="handover-order-id">

            <span>
              ORDER / KOT
            </span>

            <strong>
              #{label(order)}
            </strong>

          </div>

          <div
            className={`payment-highlight ${
              isPrepaid
                ? "payment-prepaid"
                : "payment-cod"
            }`}
          >

            <span>
              PAYMENT
            </span>

            <strong>
              {paymentLabel}
            </strong>

            <b>
              ₹
              {Number(
                order.total || 0
              ).toLocaleString(
                "en-IN"
              )}
            </b>

          </div>

          <div className="kot-line" />

          <h3>
            CUSTOMER DETAILS
          </h3>

          <p>
            <strong>
              Name:
            </strong>{" "}
            {order.customerName ||
              order.name ||
              "Customer"}
          </p>

          <p>
            <strong>
              Phone:
            </strong>{" "}
            {order.phone ||
              order.mobile ||
              "—"}
          </p>

          <p>
            <strong>
              Address:
            </strong>{" "}
            {address}
          </p>

          {order.landmark && (
            <p>
              <strong>
                Landmark:
              </strong>{" "}
              {order.landmark}
            </p>
          )}

          <div className="kot-line" />

          <p>
            <strong>
              Delivery Type:
            </strong>{" "}
            {order.orderType ||
              "Delivery"}
          </p>

          <p>
            <strong>
              OTP:
            </strong>{" "}
            <span className="delivery-otp">
              {order.deliveryOtp ||
                order.otp ||
                "—"}
            </span>
          </p>

          <p>
            <strong>
              Total:
            </strong>{" "}
            ₹
            {Number(
              order.total || 0
            ).toLocaleString(
              "en-IN"
            )}
          </p>

          <div className="handover-warning">

            {isPrepaid
              ? "✓ PAYMENT RECEIVED — DO NOT COLLECT CASH"
              : "⚠ COLLECT CASH FROM CUSTOMER — CASH ON DELIVERY"}

          </div>

          <div className="kot-line" />

          <p className="handover-sign">
            Delivery Partner Signature:
            {" "}
            __________________
          </p>

        </section>

        {/* =================================================
            SCREEN ACTIONS
        ================================================= */}

        <div className="screen-actions">

          <div className="kot-preparation">

            <h3>
              ⏱ PREPARATION
            </h3>

            {status ===
              "Preparing" && (
              <>
                <div className="kot-timer">
                  {timeLeft}
                </div>

                <p className="kot-timer-label">
                  {remainingSeconds >
                  0
                    ? "Preparation time remaining"
                    : "⚠️ Preparation time completed"}
                </p>

                <button
                  className="food-ready-btn"
                  onClick={
                    markFoodReady
                  }
                  disabled={saving}
                >
                  🍽️ FOOD READY
                </button>
              </>
            )}

            {status ===
              "Food Ready" && (
              <button
                className="dispatch-btn"
                onClick={
                  dispatchOrder
                }
                disabled={saving}
              >
                🚴 DISPATCH ORDER
              </button>
            )}

            {status ===
              "Dispatched" && (
              <button
                className="delivered-btn"
                onClick={
                  markDelivered
                }
                disabled={saving}
              >
                ✅ MARK DELIVERED
              </button>
            )}

            {status ===
              "Delivered" && (
              <div className="kot-delivered-message">
                ✅ Order Delivered
              </div>
            )}

          </div>

          {/* =================================================
              BUTTONS
          ================================================= */}

          <div className="kot-buttons">

            <button
              onClick={() =>
                printKOT()
              }
              disabled={saving}
            >
              🖨️ PRINT 2 SLIPS
            </button>

            <button
              onClick={onClose}
            >
              Close
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
