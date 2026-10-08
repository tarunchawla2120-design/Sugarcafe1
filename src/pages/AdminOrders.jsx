import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc,
  runTransaction
} from "firebase/firestore";

import { db } from "../firebase";
import { useStoreSettings } from "../context/StoreContext";
import Sidebar from "../components/admin/Sidebar";
import "./AdminOrders.css";

/* =========================================================
   PUSH NOTIFICATION
========================================================= */

const PAYMENT_API_URL =
  import.meta.env.VITE_PAYMENT_API_URL || "";

async function sendOrderStatusNotification(order, status) {
  if (!order?.customerId || !status) return;

  try {
    const response = await fetch(
      `${PAYMENT_API_URL}/api/notifications/order-status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerId: String(order.customerId),
          orderId: String(order.id || ""),
          orderNumber: String(
            order.orderNumber ||
              order.orderNo ||
              order.orderId ||
              order.id ||
              ""
          ),
          status: String(status),
          orderType: String(
            order.orderType || "Delivery"
          )
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.warn(
        "Order push notification failed:",
        data?.error || "Unknown error"
      );
      return;
    }

    console.log(
      `Push notification sent for ${status}:`,
      data
    );
  } catch (error) {
    console.error(
      "Order push notification error:",
      error
    );
  }
}

/* =========================================================
   STATUS
========================================================= */

const STATUS = [
  "All",
  "Waiting",
  "Preparing",
  "Food Ready",
  "Dispatched",
  "Delivered",
  "Rejected",
  "Cancelled"
];

/* =========================================================
   HELPERS
========================================================= */

function toMillis(value) {
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

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

/* =========================================================
   CONFIRMATION HELPERS
========================================================= */

function isWaitingForConfirmation(order) {
  return (
    String(
      order?.status || ""
    ).toUpperCase() ===
    "WAITING_FOR_CONFIRMATION"
  );
}

function confirmationRemaining(
  order,
  currentTime
) {
  const deadline =
    toMillis(
      order?.confirmationDeadline
    );

  if (!deadline) return 0;

  return Math.max(
    0,
    Math.ceil(
      (deadline - currentTime) / 1000
    )
  );
}

function confirmationTimeLabel(
  order,
  currentTime
) {
  const seconds =
    confirmationRemaining(
      order,
      currentTime
    );

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

/* =========================================================
   DISPLAY HELPERS
========================================================= */

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString("en-IN")}`;
}

function label(order) {
  return (
    order.orderNumber ||
    order.orderNo ||
    order.orderId ||
    order.id?.slice(-8).toUpperCase() ||
    "—"
  );
}

function itemsFor(order) {
  return (
    order.items ||
    order.orderItems ||
    order.cart ||
    order.products ||
    []
  );
}

function addressFor(order) {
  if (typeof order.address === "string") {
    return order.address;
  }

  if (
    order.address &&
    typeof order.address === "object"
  ) {
    return (
      order.address.fullAddress ||
      order.address.address ||
      [
        order.address.houseNo,
        order.address.area,
        order.address.locality,
        order.address.landmark,
        order.address.city,
        order.address.state,
        order.address.pincode
      ]
        .filter(Boolean)
        .join(", ")
    );
  }

  return (
    order.deliveryAddress ||
    order.customerAddress ||
    order.fullAddress ||
    "Address not available"
  );
}

/* =========================================================
   DAILY SCRATCH
========================================================= */

function isDailyScratchItem(item) {
  return (
    item?.isFreeReward === true &&
    item?.dailyScratchReward === true
  );
}

function getDailyScratchReward(order) {
  return (
    order?.dailyScratchReward || null
  );
}

function getDailyScratchRewardText(order) {
  const reward =
    getDailyScratchReward(order);

  if (!reward?.enabled) return "";

  if (
    reward.type === "discount" ||
    Number(reward.discountPercent) === 5
  ) {
    const amount = Number(
      reward.appliedDiscount || 0
    );

    return amount > 0
      ? `5% OFF · ${money(
          amount
        )} discount`
      : "5% OFF";
  }

  if (
    reward.type === "free_menu_item" ||
    reward.type === "free_item"
  ) {
    return `FREE ${
      reward.itemName ||
      reward.title ||
      "Reward Item"
    }`;
  }

  return (
    reward.title ||
    "Scratch & Win Reward"
  );
}

/* =========================================================
   ELECTRON PRINT BRIDGE
========================================================= */

function getElectronPrinter() {
  try {
    if (
      typeof window !== "undefined" &&
      window.electronAPI &&
      typeof window.electronAPI.printKOT ===
        "function"
    ) {
      return window.electronAPI;
    }

    if (
      typeof window !== "undefined" &&
      window.sugarCafeDesktop &&
      typeof window.sugarCafeDesktop.printKOT ===
        "function"
    ) {
      return window.sugarCafeDesktop;
    }
  } catch (error) {
    console.error(
      "Electron bridge error:",
      error
    );
  }

  return null;
}

/* =========================================================
   DAILY SCRATCH BADGE
========================================================= */

function DailyScratchBadge({ order }) {
  const reward =
    getDailyScratchReward(order);

  if (!reward?.enabled) return null;

  const isDiscount =
    reward.type === "discount" ||
    Number(reward.discountPercent) === 5;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(135deg,#fff7ed,#ffedd5)",
        border: "1px solid #fed7aa",
        display: "flex",
        alignItems: "center",
        gap: 9,
        color: "#9a3412",
        fontSize: 13,
        fontWeight: 700
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          background: "#fff",
          fontSize: 16,
          flexShrink: 0
        }}
      >
        🎁
      </span>

      <span>
        <strong
          style={{
            display: "block",
            fontSize: 11,
            letterSpacing: ".05em",
            marginBottom: 2
          }}
        >
          DAILY SCRATCH & WIN
        </strong>

        <span>
          {getDailyScratchRewardText(
            order
          )}
        </span>

        {isDiscount &&
          Number(
            reward.appliedDiscount || 0
          ) > 0 && (
            <small
              style={{
                display: "block",
                marginTop: 2,
                fontWeight: 600,
                opacity: 0.8
              }}
            >
              Applied on this order
            </small>
          )}
      </span>
    </div>
  );
}

/* =========================================================
   KOT MODAL
========================================================= */

function KOTModal({
  order,
  onClose,
  onPrint
}) {
  if (!order) return null;

  const items = itemsFor(order);

  const scratchReward =
    getDailyScratchReward(order);

  const created =
    toMillis(order.createdAt);

  const date = created
    ? new Date(created)
    : new Date();

  return (
    <div
      className="sc-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="sc-kot-modal">

        <div className="sc-kot-head">
          <div>
            <b>☕ SUGAR CAFE</b>

            <span>
              KITCHEN ORDER TICKET
            </span>
          </div>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        <div className="sc-kot-meta">
          <b>
            #{label(order)}
          </b>

          <span>
            {date.toLocaleDateString(
              "en-IN"
            )}{" "}
            ·{" "}
            {date.toLocaleTimeString(
              "en-IN",
              {
                hour: "2-digit",
                minute: "2-digit"
              }
            )}
          </span>

          <em>
            {order.orderType ||
              "Delivery"}
          </em>
        </div>

        <section>
          <small>CUSTOMER</small>

          <strong>
            {order.customerName ||
              order.name ||
              "Customer"}
          </strong>

          <div>
            {order.phone ||
              order.mobile ||
              "—"}
          </div>

          <div>
            {addressFor(order)}
          </div>
        </section>

        {scratchReward?.enabled && (
          <section
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#fff7ed",
              border:
                "1px solid #fed7aa"
            }}
          >
            <small
              style={{
                color: "#9a3412",
                fontWeight: 800
              }}
            >
              🎁 DAILY SCRATCH & WIN
            </small>

            <strong
              style={{
                display: "block",
                marginTop: 4,
                color: "#7c2d12"
              }}
            >
              {getDailyScratchRewardText(
                order
              )}
            </strong>

            {(
              scratchReward.type ===
                "discount" ||
              Number(
                scratchReward.discountPercent
              ) === 5
            ) &&
              Number(
                scratchReward.appliedDiscount ||
                  0
              ) > 0 && (
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 12,
                    color: "#9a3412"
                  }}
                >
                  Discount applied:{" "}
                  {money(
                    scratchReward.appliedDiscount
                  )}
                </div>
              )}
          </section>
        )}

        <section>
          <small>ORDER ITEMS</small>

          {items.length ? (
            items.map((item, i) => {
              const qty = Number(
                item.qty ||
                  item.quantity ||
                  1
              );

              const dailyScratchFree =
                isDailyScratchItem(
                  item
                );

              const itemTotal =
                Number(
                  item.price || 0
                ) * qty;

              return (
                <div
                  className="kot-item"
                  key={
                    item.id || i
                  }
                >
                  <span>
                    {dailyScratchFree && (
                      <span
                        style={{
                          marginRight: 5,
                          fontWeight: 800
                        }}
                      >
                        🎁
                      </span>
                    )}

                    {dailyScratchFree
                      ? `FREE ${
                          item.name ||
                          item.productName ||
                          "Food Item"
                        }`
                      : item.name ||
                        item.productName ||
                        "Food Item"}

                    {" "}×{qty}
                  </span>

                  <b>
                    {dailyScratchFree
                      ? "FREE"
                      : money(itemTotal)}
                  </b>
                </div>
              );
            })
          ) : (
            <div>
              No items found.
            </div>
          )}
        </section>

        {(order.instructions ||
          order.specialNote ||
          order.note) && (
          <div className="kot-note">
            <b>★ SPECIAL NOTE:</b>{" "}
            {order.instructions ||
              order.specialNote ||
              order.note}
          </div>
        )}

        <div className="kot-total">
          <span>Total</span>

          <b>
            {money(order.total)}
          </b>
        </div>

        <div className="kot-actions">
          <button
            onClick={() =>
              onPrint(order)
            }
          >
            🖨 Print KOT
          </button>

          <button
            className="dark"
            onClick={onClose}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   ADMIN ORDERS
========================================================= */

function AdminOrders() {
  const [orders, setOrders] =
    useState([]);

  const [filter, setFilter] =
    useState("All");

  const [query, setQuery] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [newOrder, setNewOrder] =
    useState(null);

  const [kotOrder, setKotOrder] =
    useState(null);

  const [now, setNow] =
    useState(Date.now());

  const store =
    useStoreSettings();

  /* =======================================================
     AUDIO REFS
  ======================================================= */

  const alarmRef =
    useRef(null);

  const audioGenerationRef =
    useRef(0);

  const isBellPlayingRef =
    useRef(false);

  const audioUnlockedRef =
    useRef(false);

  const unlockingAudioRef =
    useRef(false);

  const buzzedPreparation =
    useRef(new Set());

  const knownIds =
    useRef(new Set());

  const firstSnapshot =
    useRef(true);

  const autoCancellingRef =
    useRef(new Set());

  /* =======================================================
     CREATE AUDIO
  ======================================================= */

  const getAlarmAudio =
    useCallback(() => {
      if (
        typeof window ===
        "undefined"
      ) {
        return null;
      }

      try {
        if (!alarmRef.current) {
          const audio =
            new Audio(
              "/order-ringtone.mp3"
            );

          audio.preload = "auto";
          audio.loop = true;
          audio.volume = 1;
          audio.muted = false;

          audio.addEventListener(
            "ended",
            () => {
              if (!audio.loop) {
                isBellPlayingRef.current =
                  false;
              }
            }
          );

          audio.addEventListener(
            "error",
            (event) => {
              console.error(
                "❌ Ringtone audio error:",
                event
              );

              isBellPlayingRef.current =
                false;
            }
          );

          alarmRef.current =
            audio;
        }

        return alarmRef.current;
      } catch (error) {
        console.error(
          "❌ Audio creation error:",
          error
        );

        return null;
      }
    }, []);

  /* =======================================================
     UNLOCK AUDIO
  ======================================================= */

  const unlockAlarmAudio =
    useCallback(async () => {
      if (
        audioUnlockedRef.current
      ) {
        return true;
      }

      if (
        unlockingAudioRef.current
      ) {
        return new Promise(
          (resolve) => {
            let attempts = 0;

            const check = () => {
              attempts += 1;

              if (
                audioUnlockedRef.current
              ) {
                resolve(true);
                return;
              }

              if (
                !unlockingAudioRef.current
              ) {
                resolve(
                  audioUnlockedRef.current
                );
                return;
              }

              if (attempts >= 40) {
                resolve(false);
                return;
              }

              setTimeout(
                check,
                50
              );
            };

            check();
          }
        );
      }

      unlockingAudioRef.current =
        true;

      try {
        const audio =
          getAlarmAudio();

        if (!audio) {
          return false;
        }

        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
        audio.muted = false;
        audio.volume = 1;

        const playPromise =
          audio.play();

        if (
          playPromise &&
          typeof playPromise.then ===
            "function"
        ) {
          await playPromise;
        }

        audioUnlockedRef.current =
          true;

        isBellPlayingRef.current =
          true;

        setTimeout(() => {
          try {
            if (
              alarmRef.current ===
              audio
            ) {
              audio.pause();
              audio.currentTime = 0;
              audio.loop = true;

              isBellPlayingRef.current =
                false;
            }
          } catch {
            // ignore
          }
        }, 1200);

        return true;
      } catch (error) {
        audioUnlockedRef.current =
          false;

        console.warn(
          "⚠️ SugarCafe ringtone unlock failed:",
          error
        );

        return false;
      } finally {
        unlockingAudioRef.current =
          false;
      }
    }, [
      getAlarmAudio
    ]);

  /* =======================================================
     PLAY BELL
  ======================================================= */

  const playBell =
    useCallback(async () => {
      if (
        store.buzzerEnabled ===
        false
      ) {
        return;
      }

      const audio =
        getAlarmAudio();

      if (!audio) {
        return;
      }

      if (
        isBellPlayingRef.current &&
        !audio.paused &&
        audio.loop
      ) {
        return;
      }

      audioGenerationRef.current +=
        1;

      const generation =
        audioGenerationRef.current;

      try {
        audio.pause();
        audio.currentTime = 0;
        audio.loop = true;
        audio.muted = false;
        audio.volume = 1;

        const playPromise =
          audio.play();

        if (
          playPromise &&
          typeof playPromise.then ===
            "function"
        ) {
          await playPromise;
        }

        if (
          generation !==
          audioGenerationRef.current
        ) {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            // ignore
          }

          return;
        }

        isBellPlayingRef.current =
          true;

        console.log(
          "🔔 SugarCafe ringtone PLAYING continuously"
        );
      } catch (error) {
        isBellPlayingRef.current =
          false;

        console.warn(
          "⚠️ Order ringtone could not play:",
          error
        );
      }
    }, [
      getAlarmAudio,
      store.buzzerEnabled
    ]);

  /* =======================================================
     STOP BELL
  ======================================================= */

  const stopBell =
    useCallback(() => {
      audioGenerationRef.current +=
        1;

      isBellPlayingRef.current =
        false;

      try {
        const audio =
          alarmRef.current;

        if (!audio) {
          return;
        }

        audio.pause();

        try {
          audio.currentTime = 0;
        } catch {
          // ignore
        }

        audio.loop = false;
        audio.muted = false;
        audio.volume = 1;
      } catch (error) {
        console.error(
          "❌ Stop ringtone error:",
          error
        );
      }
    }, []);

  /* =======================================================
     FIREBASE ORDERS
  ======================================================= */

  useEffect(() => {
    const unsub =
      onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          const data =
            snapshot.docs
              .map((d) => ({
                id: d.id,
                ...d.data()
              }))
              .sort(
                (a, b) =>
                  (toMillis(
                    b.createdAt
                  ) || 0) -
                  (toMillis(
                    a.createdAt
                  ) || 0)
              );

          setOrders(data);
          setLoading(false);

          snapshot.docChanges().forEach(
            (change) => {
              if (
                change.type ===
                  "added" &&
                !firstSnapshot.current &&
                !knownIds.current.has(
                  change.doc.id
                )
              ) {
                const incoming = {
                  id: change.doc.id,
                  ...change.doc.data()
                };

                if (
                  isWaitingForConfirmation(
                    incoming
                  )
                ) {
                  setNewOrder(
                    incoming
                  );

                  playBell();
                }
              }

              knownIds.current.add(
                change.doc.id
              );
            }
          );

          /* =================================================
             FIRST SNAPSHOT
             Show latest active waiting order
          ================================================= */

          if (
            firstSnapshot.current
          ) {
            const waitingOrders =
              data.filter(
                (order) =>
                  isWaitingForConfirmation(
                    order
                  ) &&
                  confirmationRemaining(
                    order,
                    Date.now()
                  ) > 0
              );

            if (
              waitingOrders.length
            ) {
              setNewOrder(
                waitingOrders[0]
              );

              playBell();
            }
          }

          firstSnapshot.current =
            false;
        },
        (err) => {
          console.error(
            "Orders listener error:",
            err
          );

          setError(
            "Orders load nahi ho paaye. Firebase connection/rules check karein."
          );

          setLoading(false);
        }
      );

    return () => unsub();
  }, [playBell]);

  /* =======================================================
     CLOCK
  ======================================================= */

  useEffect(() => {
    const id =
      setInterval(() => {
        setNow(Date.now());
      }, 1000);

    return () =>
      clearInterval(id);
  }, []);

  /* =======================================================
     AUTOMATIC 60 SECOND CANCELLATION
  ======================================================= */

  useEffect(() => {
    if (!orders.length) {
      return;
    }

    orders.forEach(async (order) => {
      if (
        !isWaitingForConfirmation(
          order
        )
      ) {
        return;
      }

      const deadline =
        toMillis(
          order.confirmationDeadline
        );

      if (!deadline || now < deadline) {
        return;
      }

      if (
        autoCancellingRef.current.has(
          order.id
        )
      ) {
        return;
      }

      autoCancellingRef.current.add(
        order.id
      );

      try {
        const didCancel =
          await runTransaction(
            db,
            async (transaction) => {
              const orderRef =
                doc(
                  db,
                  "orders",
                  order.id
                );

              const snap =
                await transaction.get(
                  orderRef
                );

              if (!snap.exists()) {
                return false;
              }

              const current =
                snap.data();

              const currentStatus =
                String(
                  current.status || ""
                ).toUpperCase();

              const currentDeadline =
                toMillis(
                  current.confirmationDeadline
                );

              if (
                currentStatus !==
                "WAITING_FOR_CONFIRMATION"
              ) {
                return false;
              }

              if (
                !currentDeadline ||
                Date.now() <
                  currentDeadline
              ) {
                return false;
              }

              transaction.update(
                orderRef,
                {
                  status:
                    "CANCELLED",

                  confirmationStatus:
                    "AUTO_CANCELLED",

                  cancelledAt:
                    Timestamp.now(),

                  cancellationReason:
                    "Store did not confirm the order within 60 seconds",

                  acceptedAt: null,

                  preparationStartedAt:
                    null,

                  preparationEndAt:
                    null
                }
              );

              return true;
            }
          );

        if (didCancel) {
          await sendOrderStatusNotification(
            order,
            "CANCELLED"
          );

          if (
            newOrder?.id ===
            order.id
          ) {
            stopBell();
            setNewOrder(null);
          }
        }

        autoCancellingRef.current.delete(
          order.id
        );
      } catch (error) {
        console.error(
          "Automatic order cancellation failed:",
          error
        );

        autoCancellingRef.current.delete(
          order.id
        );
      }
    });
  }, [
    now,
    orders,
    newOrder,
    stopBell
  ]);

  /* =======================================================
     PREPARATION TIMER BELL
  ======================================================= */

  useEffect(() => {
    if (
      store.buzzerEnabled ===
      false
    ) {
      return;
    }

    orders.forEach((order) => {
      if (
        String(
          order.status || ""
        ) !== "Preparing"
      ) {
        return;
      }

      const end =
        toMillis(
          order.preparationEndAt
        );

      if (
        !end ||
        end > now ||
        buzzedPreparation.current.has(
          order.id
        )
      ) {
        return;
      }

      buzzedPreparation.current.add(
        order.id
      );

      playBell();
    });
  }, [
    now,
    orders,
    store.buzzerEnabled,
    playBell
  ]);

  /* =======================================================
     STOP BELL WHEN BUZZER DISABLED
  ======================================================= */

  useEffect(() => {
    if (
      store.buzzerEnabled ===
      false
    ) {
      stopBell();
    }
  }, [
    store.buzzerEnabled,
    stopBell
  ]);

  /* =======================================================
     CLEANUP AUDIO
  ======================================================= */

  useEffect(() => {
    return () => {
      try {
        audioGenerationRef.current +=
          1;

        if (alarmRef.current) {
          alarmRef.current.pause();

          try {
            alarmRef.current.currentTime =
              0;
          } catch {
            // ignore
          }

          alarmRef.current.loop =
            false;

          alarmRef.current.muted =
            false;

          alarmRef.current = null;
        }

        isBellPlayingRef.current =
          false;

        audioUnlockedRef.current =
          false;
      } catch (error) {
        console.error(
          "Audio cleanup error:",
          error
        );
      }
    };
  }, []);

  /* =======================================================
     UPDATE ORDER
  ======================================================= */

  const updateOrder = async (
    order,
    updates
  ) => {
    try {
      await updateDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        updates
      );

      if (
        newOrder?.id ===
        order.id
      ) {
        stopBell();
        setNewOrder(null);
      }

      let notificationStatus =
        updates?.status || "";

      if (
        updates?.confirmationStatus ===
        "ACCEPTED"
      ) {
        notificationStatus =
          "CONFIRMED";
      }

      if (
        updates?.confirmationStatus ===
        "REJECTED"
      ) {
        notificationStatus =
          "REJECTED";
      }

      if (
        updates?.confirmationStatus ===
        "AUTO_CANCELLED"
      ) {
        notificationStatus =
          "CANCELLED";
      }

      if (
        notificationStatus &&
        String(
          notificationStatus
        ).trim()
      ) {
        sendOrderStatusNotification(
          order,
          notificationStatus
        ).catch(
          (notificationError) => {
            console.error(
              "Background order notification error:",
              notificationError
            );
          }
        );
      }

      return true;
    } catch (e) {
      console.error(
        "Order update error:",
        e
      );

      alert(
        "Order update nahi ho paya."
      );

      return false;
    }
  };

  /* =======================================================
     PRINT KOT
  ======================================================= */

  const printKOT = async (
    order
  ) => {
    if (
      isWaitingForConfirmation(
        order
      )
    ) {
      alert(
        "Order abhi store confirmation ka wait kar raha hai.\n\n" +
          "Pehle order Accept karein, uske baad KOT print hoga."
      );

      return false;
    }

    if (
      String(
        order?.status || ""
      ).toUpperCase() ===
        "CANCELLED" ||
      String(
        order?.status || ""
      ).toUpperCase() ===
        "REJECTED"
    ) {
      alert(
        "Rejected/Cancelled order ka KOT print nahi hoga."
      );

      return false;
    }

    try {
      const electron =
        getElectronPrinter();

      if (!electron) {
        alert(
          "Automatic KOT printing ke liye SugarCafe Dashboard Windows App open karein.\n\n" +
            "Chrome/browser se silent printing possible nahi hai."
        );

        return false;
      }

      const result =
        await electron.printKOT(
          order
        );

      if (!result?.success) {
        const reason =
          result?.error ||
          result?.failureReason ||
          "Unknown printing error";

        alert(
          "KOT printing failed.\n\n" +
            reason +
            "\n\n" +
            "TVS-E RP 3230 printer check karein."
        );

        return false;
      }

      console.log(
        "KOT + Counter Slip printed successfully.",
        result.printer || ""
      );

      return true;
    } catch (error) {
      console.error(
        "KOT print exception:",
        error
      );

      alert(
        "KOT printing mein error aaya.\n\n" +
          (
            error?.message ||
            "Unknown error"
          )
      );

      return false;
    }
  };

  /* =======================================================
     ACCEPT ORDER
     
     IMPORTANT:
     Firestore transaction guarantees:
     - Only WAITING order can be accepted.
     - Deadline must not be crossed.
     - Preparation starts ONLY after acceptance.
     ======================================================= */

  const accept = async (
    order
  ) => {
    if (!order?.id) {
      alert(
        "Order ID nahi mila."
      );

      return false;
    }

    stopBell();

    try {
      const result =
        await runTransaction(
          db,
          async (transaction) => {
            const orderRef =
              doc(
                db,
                "orders",
                order.id
              );

            const snap =
              await transaction.get(
                orderRef
              );

            if (!snap.exists()) {
              return {
                accepted: false,
                expired: false,
                reason: "NOT_FOUND"
              };
            }

            const current =
              snap.data();

            const currentStatus =
              String(
                current.status || ""
              ).toUpperCase();

            const deadline =
              toMillis(
                current.confirmationDeadline
              );

            /*
             * Order already handled.
             */
            if (
              currentStatus !==
              "WAITING_FOR_CONFIRMATION"
            ) {
              return {
                accepted: false,
                expired: false,
                reason: "ALREADY_HANDLED"
              };
            }

            /*
             * 60 seconds expired.
             */
            if (
              !deadline ||
              Date.now() >= deadline
            ) {
              transaction.update(
                orderRef,
                {
                  status:
                    "CANCELLED",

                  confirmationStatus:
                    "AUTO_CANCELLED",

                  cancelledAt:
                    Timestamp.now(),

                  cancellationReason:
                    "Store did not confirm the order within 60 seconds",

                  acceptedAt: null,

                  preparationStartedAt:
                    null,

                  preparationEndAt:
                    null
                }
              );

              return {
                accepted: false,
                expired: true,
                reason: "EXPIRED"
              };
            }

            const minutes =
              Number(
                current.preparationMinutes ??
                  15
              );

            const started =
              Date.now();

            const end =
              started +
              minutes * 60000;

            transaction.update(
              orderRef,
              {
                status:
                  "Preparing",

                confirmationStatus:
                  "ACCEPTED",

                acceptedAt:
                  Timestamp.fromMillis(
                    started
                  ),

                rejectedAt: null,

                cancelledAt: null,

                cancellationReason:
                  "",

                rejectionReason:
                  "",

                preparationStartedAt:
                  Timestamp.fromMillis(
                    started
                  ),

                preparationEndAt:
                  Timestamp.fromMillis(
                    end
                  ),

                preparationMinutes:
                  minutes,

                foodReadyAt: null,

                dispatchedAt: null,

                deliveredAt: null
              }
            );

            return {
              accepted: true,
              expired: false,
              minutes,
              started,
              end,
              current
            };
          }
        );

      if (
        result.expired
      ) {
        stopBell();

        setNewOrder(
          (current) =>
            current?.id === order.id
              ? null
              : current
        );

        await sendOrderStatusNotification(
          order,
          "CANCELLED"
        );

        alert(
          "60 seconds complete ho gaye the.\n\nOrder automatically Cancelled ho gaya."
        );

        return false;
      }

      if (!result.accepted) {
        stopBell();

        setNewOrder(
          (current) =>
            current?.id === order.id
              ? null
              : current
        );

        if (
          result.reason ===
          "ALREADY_HANDLED"
        ) {
          alert(
            "Ye order already accept/reject/cancel ho chuka hai."
          );
        }

        return false;
      }

      /*
       * Confirmation notification.
       */
      await sendOrderStatusNotification(
        order,
        "CONFIRMED"
      );

      /*
       * KOT payload AFTER acceptance only.
       */
      const printPayload = {
        ...order,

        status: "Preparing",

        confirmationStatus:
          "ACCEPTED",

        acceptedAt:
          Timestamp.fromMillis(
            result.started
          ),

        preparationStartedAt:
          Timestamp.fromMillis(
            result.started
          ),

        preparationEndAt:
          Timestamp.fromMillis(
            result.end
          ),

        preparationMinutes:
          result.minutes
      };

      let printed = false;

      for (
        let attempt = 1;
        attempt <= 3 &&
        !printed;
        attempt++
      ) {
        console.log(
          `KOT print attempt ${attempt}/3`
        );

        printed =
          await printKOT(
            printPayload
          );

        if (
          !printed &&
          attempt < 3
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                1000
              )
          );
        }
      }

      if (!printed) {
        alert(
          "Order accepted successfully.\n\n" +
            "Lekin KOT + Counter Slip print nahi hui.\n\n" +
            "SugarCafe Dashboard App aur TVS-E RP 3230 printer check karein."
        );
      }

      return true;
    } catch (error) {
      console.error(
        "Accept order error:",
        error
      );

      alert(
        "Order accept nahi ho paya.\n\n" +
          (
            error?.message ||
            "Unknown error"
          )
      );

      return false;
    }
  };

  /* =======================================================
     REJECT ORDER
     
     IMPORTANT:
     Reject bhi transaction ke through hoga.
     60 sec ke baad reject impossible.
  ======================================================= */

  const reject = async (
    order
  ) => {
    if (!order?.id) {
      alert(
        "Order ID nahi mila."
      );

      return false;
    }

    try {
      stopBell();

      const result =
        await runTransaction(
          db,
          async (transaction) => {
            const orderRef =
              doc(
                db,
                "orders",
                order.id
              );

            const snap =
              await transaction.get(
                orderRef
              );

            if (!snap.exists()) {
              return {
                rejected: false,
                expired: false,
                reason: "NOT_FOUND"
              };
            }

            const current =
              snap.data();

            const currentStatus =
              String(
                current.status || ""
              ).toUpperCase();

            const deadline =
              toMillis(
                current.confirmationDeadline
              );

            if (
              currentStatus !==
              "WAITING_FOR_CONFIRMATION"
            ) {
              return {
                rejected: false,
                expired: false,
                reason: "ALREADY_HANDLED"
              };
            }

            if (
              !deadline ||
              Date.now() >= deadline
            ) {
              transaction.update(
                orderRef,
                {
                  status:
                    "CANCELLED",

                  confirmationStatus:
                    "AUTO_CANCELLED",

                  cancelledAt:
                    Timestamp.now(),

                  cancellationReason:
                    "Store did not confirm the order within 60 seconds",

                  acceptedAt: null,

                  preparationStartedAt:
                    null,

                  preparationEndAt:
                    null
                }
              );

              return {
                rejected: false,
                expired: true,
                reason: "EXPIRED"
              };
            }

            transaction.update(
              orderRef,
              {
                status:
                  "Rejected",

                confirmationStatus:
                  "REJECTED",

                rejectionReason:
                  "Order rejected by staff",

                rejectedAt:
                  Timestamp.now(),

                acceptedAt: null,

                preparationStartedAt:
                  null,

                preparationEndAt:
                  null,

                cancelledAt: null,

                cancellationReason:
                  ""
              }
            );

            return {
              rejected: true,
              expired: false
            };
          }
        );

      if (
        result.expired
      ) {
        await sendOrderStatusNotification(
          order,
          "CANCELLED"
        );

        setNewOrder(
          (current) =>
            current?.id === order.id
              ? null
              : current
        );

        alert(
          "60 seconds complete ho gaye the.\n\nOrder automatically Cancelled ho gaya."
        );

        return false;
      }

      if (
        !result.rejected
      ) {
        setNewOrder(
          (current) =>
            current?.id === order.id
              ? null
              : current
        );

        if (
          result.reason ===
          "ALREADY_HANDLED"
        ) {
          alert(
            "Ye order already accept/reject/cancel ho chuka hai."
          );
        }

        return false;
      }

      await sendOrderStatusNotification(
        order,
        "REJECTED"
      );

      setNewOrder(
        (current) =>
          current?.id === order.id
            ? null
            : current
      );

      return true;
    } catch (error) {
      console.error(
        "Reject order error:",
        error
      );

      alert(
        "Order reject nahi ho paya.\n\n" +
          (
            error?.message ||
            "Unknown error"
          )
      );

      return false;
    }
  };

  /* =======================================================
     EXTRA TIME
  ======================================================= */

  const extra = (
    order
  ) => {
    const mins =
      Number(
        order.extraPreparationMinutes ??
          10
      );

    const base =
      toMillis(
        order.preparationEndAt
      ) || now;

    return updateOrder(
      order,
      {
        preparationEndAt:
          Timestamp.fromMillis(
            base +
              mins * 60000
          ),

        extraTimeAdded:
          mins
      }
    );
  };

  /* =======================================================
     READY
  ======================================================= */

  const ready = async (
    order
  ) => {
    stopBell();

    return updateOrder(
      order,
      {
        status:
          "Food Ready",

        foodReadyAt:
          Timestamp.now()
      }
    );
  };

  /* =======================================================
     DISPATCH
  ======================================================= */

  const dispatch = (
    order
  ) =>
    updateOrder(
      order,
      {
        status:
          "Dispatched",

        dispatchedAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     DELIVERED
  ======================================================= */

  const delivered = (
    order
  ) =>
    updateOrder(
      order,
      {
        status:
          "Delivered",

        deliveredAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     UPI
  ======================================================= */

  const verifyUpi = (
    order
  ) =>
    updateOrder(
      order,
      {
        paymentStatus:
          "Paid",

        paymentVerifiedAt:
          Timestamp.now()
      }
    );

  /* =======================================================
     COUNTS
  ======================================================= */

  const counts =
    useMemo(
      () =>
        STATUS.reduce(
          (a, s) => {
            if (s === "All") {
              a[s] =
                orders.length;

              return a;
            }

            a[s] =
              orders.filter(
                (o) => {
                  const raw =
                    String(
                      o.status || ""
                    ).toUpperCase();

                  if (
                    s === "Waiting"
                  ) {
                    return (
                      raw ===
                      "WAITING_FOR_CONFIRMATION"
                    );
                  }

                  if (
                    s ===
                    "Cancelled"
                  ) {
                    return (
                      raw ===
                      "CANCELLED"
                    );
                  }

                  return (
                    raw ===
                    s.toUpperCase()
                  );
                }
              ).length;

            return a;
          },
          {}
        ),
      [orders]
    );

  /* =======================================================
     FILTER
  ======================================================= */

  const filtered =
    useMemo(
      () =>
        orders.filter(
          (o) => {
            const q =
              query
                .trim()
                .toLowerCase();

            const rawStatus =
              String(
                o.status || ""
              ).toUpperCase();

            let displayStatus =
              rawStatus;

            if (
              rawStatus ===
              "WAITING_FOR_CONFIRMATION"
            ) {
              displayStatus =
                "Waiting";
            }

            if (
              rawStatus ===
              "CANCELLED"
            ) {
              displayStatus =
                "Cancelled";
            }

            const searchable = [
              label(o),
              o.customerName,
              o.name,
              o.phone,
              o.mobile,
              addressFor(o),
              o.orderType
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return (
              (
                filter === "All" ||
                displayStatus ===
                  filter
              ) &&
              (
                !q ||
                searchable.includes(q)
              )
            );
          }
        ),
      [
        orders,
        filter,
        query
      ]
    );

  /* =======================================================
     PREPARATION TIMER
  ======================================================= */

  const remaining = (
    order
  ) => {
    const end =
      toMillis(
        order.preparationEndAt
      );

    if (!end) {
      return "00:00";
    }

    const sec =
      Math.max(
        0,
        Math.floor(
          (end - now) / 1000
        )
      );

    return `${String(
      Math.floor(sec / 60)
    ).padStart(2, "0")}:${String(
      sec % 60
    ).padStart(2, "0")}`;
  };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="sc-orders-shell">

      <Sidebar />

      <main className="sc-orders-main">

        <header className="orders-top">

          <div>
            <div className="brand-kicker">
              SUGAR CAFE · LIVE CONTROL
            </div>

            <h1>
              Orders
            </h1>

            <p>
              Every order, status and
              kitchen action in one place.
            </p>
          </div>

          <div className="top-actions">

            <div className="store-status">

              <i
                className={
                  store.isOpen &&
                  store.acceptingOrders &&
                  store.inHours
                    ? "on"
                    : "off"
                }
              />

              {store.isOpen &&
              store.acceptingOrders &&
              store.inHours
                ? "Delivery Open"
                : "Delivery Closed"}

              <small>
                {
                  store.orderTimingLabel
                }
              </small>

            </div>

            {/* =================================================
                SOUND BUTTON
            ================================================= */}

            <button
              type="button"
              className="notification-button"
              title="Enable / Test Order Sound"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const unlocked =
                  await unlockAlarmAudio();

                if (!unlocked) {
                  alert(
                    "Sound enable nahi ho paya.\n\n" +
                      "Please 🔊 button ek baar dobara tap karein."
                  );

                  return;
                }

                const audio =
                  getAlarmAudio();

                if (!audio) {
                  return;
                }

                try {
                  audio.pause();
                  audio.currentTime = 0;
                  audio.loop = false;
                  audio.muted = false;
                  audio.volume = 1;

                  const playPromise =
                    audio.play();

                  if (
                    playPromise &&
                    typeof playPromise.then ===
                      "function"
                  ) {
                    await playPromise;
                  }

                  isBellPlayingRef.current =
                    true;

                  setTimeout(() => {
                    try {
                      if (
                        alarmRef.current ===
                          audio &&
                        !audio.loop
                      ) {
                        audio.pause();
                        audio.currentTime =
                          0;
                        audio.loop = true;

                        isBellPlayingRef.current =
                          false;
                      }
                    } catch {
                      // ignore
                    }
                  }, 2000);
                } catch (error) {
                  console.error(
                    "❌ Test ringtone failed:",
                    error
                  );

                  alert(
                    "Ringtone play nahi ho pa rahi.\n\n" +
                      "Phone ka silent mode aur volume check karein."
                  );
                }
              }}
            >
              🔊

              <b>
                {counts.Waiting || 0}
              </b>

            </button>

          </div>

        </header>

        <section className="order-toolbar">

          <div className="search">

            <span>⌕</span>

            <input
              value={query}
              onChange={(e) =>
                setQuery(
                  e.target.value
                )
              }
              placeholder="Search order, customer, phone or address"
            />

          </div>

          <button className="today">
            Today ▾
          </button>

        </section>

        <section className="status-tabs">

          {STATUS.map((s) => (
            <button
              key={s}
              className={
                filter === s
                  ? `active ${s
                      .toLowerCase()
                      .replace(
                        /\s+/g,
                        "-"
                      )}`
                  : ""
              }
              onClick={() =>
                setFilter(s)
              }
            >
              {s === "All"
                ? "All Orders"
                : s}

              <b>
                {counts[s] || 0}
              </b>
            </button>
          ))}

        </section>

        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="empty-card">
            Loading live orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-card">

            <div>📦</div>

            <h2>
              No orders found
            </h2>

            <p>
              New customer orders will
              appear here automatically.
            </p>

          </div>
        ) : (
          <div className="orders-grid">

            {filtered.map(
              (order) => {
                const rawStatus =
                  order.status || "";

                const waiting =
                  isWaitingForConfirmation(
                    order
                  );

                const status =
                  waiting
                    ? "Waiting"
                    : rawStatus ===
                      "CANCELLED"
                    ? "Cancelled"
                    : rawStatus ||
                      "Waiting";

                const items =
                  itemsFor(order);

                const created =
                  toMillis(
                    order.createdAt
                  );

                const preparationEnd =
                  toMillis(
                    order.preparationEndAt
                  );

                const expired =
                  preparationEnd !==
                    null &&
                  preparationEnd <=
                    now;

                const confirmationLeft =
                  confirmationRemaining(
                    order,
                    now
                  );

                const confirmationExpired =
                  waiting &&
                  confirmationLeft <=
                    0;

                return (
                  <article
                    className={`order-card ${status
                      .toLowerCase()
                      .replace(
                        /\s+/g,
                        "-"
                      )}`}
                    key={order.id}
                  >

                    <div className="order-main">

                      <div className="order-head">

                        <div>

                          <span className="order-no">
                            #{label(order)}
                          </span>

                          <span
                            className={`status-badge ${status
                              .toLowerCase()
                              .replace(
                                /\s+/g,
                                "-"
                              )}`}
                          >
                            {status}
                          </span>

                        </div>

                        <span className="order-time">

                          {created
                            ? new Date(
                                created
                              ).toLocaleTimeString(
                                "en-IN",
                                {
                                  hour: "2-digit",
                                  minute:
                                    "2-digit"
                                }
                              )
                            : "—"}

                        </span>

                      </div>

                      <div className="customer-block">

                        <strong>
                          {order.customerName ||
                            order.name ||
                            "Customer"}
                        </strong>

                        <span>
                          ☎{" "}
                          {order.phone ||
                            order.mobile ||
                            "—"}
                        </span>

                        <span>
                          📍{" "}
                          {order.orderType ||
                            "Delivery"}{" "}
                          ·{" "}
                          {addressFor(
                            order
                          )}
                        </span>

                        <DailyScratchBadge
                          order={order}
                        />

                      </div>

                    </div>

                    <div className="items-block">

                      {items
                        .slice(0, 5)
                        .map(
                          (
                            item,
                            i
                          ) => {
                            const qty =
                              Number(
                                item.qty ||
                                  item.quantity ||
                                  1
                              );

                            const freeScratch =
                              isDailyScratchItem(
                                item
                              );

                            return (
                              <div
                                className="item-row"
                                key={
                                  item.id ||
                                  i
                                }
                              >

                                <span>

                                  {freeScratch && (
                                    <span
                                      style={{
                                        marginRight: 4
                                      }}
                                    >
                                      🎁
                                    </span>
                                  )}

                                  {freeScratch
                                    ? `FREE ${
                                        item.name ||
                                        item.productName ||
                                        "Food Item"
                                      }`
                                    : item.name ||
                                      item.productName ||
                                      "Food Item"}

                                  <small>
                                    ×{qty}
                                  </small>

                                </span>

                                <strong>
                                  {freeScratch
                                    ? "FREE"
                                    : money(
                                        Number(
                                          item.price ||
                                            0
                                        ) *
                                          qty
                                      )}
                                </strong>

                              </div>
                            );
                          }
                        )}

                      {items.length >
                        5 && (
                        <span className="more">
                          +
                          {items.length -
                            5}{" "}
                          more items
                        </span>
                      )}

                      {getDailyScratchReward(
                        order
                      )?.enabled && (
                        <div
                          style={{
                            marginTop: 8,
                            padding:
                              "8px 10px",
                            borderRadius: 9,
                            background:
                              "#fff7ed",
                            border:
                              "1px solid #fed7aa",
                            color:
                              "#9a3412",
                            fontSize: 12,
                            fontWeight: 700
                          }}
                        >
                          🎁 Scratch Reward:{" "}
                          {getDailyScratchRewardText(
                            order
                          )}
                        </div>
                      )}

                      <div className="total-row">

                        <span>
                          Total
                        </span>

                        <strong>
                          {money(
                            order.total
                          )}
                        </strong>

                      </div>

                      <div className="payment">

                        {order.paymentMethod ||
                          "Cash on Delivery"}

                        {" · "}

                        <b
                          className={
                            order.paymentStatus ===
                            "Paid"
                              ? "paid"
                              : "pending"
                          }
                        >
                          {order.paymentStatus ||
                            "Pending"}
                        </b>

                      </div>

                    </div>

                    {/* =================================================
                        ACTIONS
                    ================================================= */}

                    <div className="action-block">

                      {/* WAITING */}
                      {waiting && (
                        <>
                          <div
                            className="timer preparation"
                            style={{
                              border:
                                "1px solid #fed7aa",
                              background:
                                "#fff7ed"
                            }}
                          >
                            <span>
                              {confirmationExpired
                                ? "Confirmation expired"
                                : "Store Confirmation"}
                            </span>

                            <strong
                              style={{
                                color:
                                  confirmationExpired
                                    ? "#dc2626"
                                    : "#ea580c"
                              }}
                            >
                              {confirmationTimeLabel(
                                order,
                                now
                              )}
                            </strong>
                          </div>

                          {!confirmationExpired ? (
                            <div className="action-row">

                              <button
                                type="button"
                                className="action reject"
                                onClick={() =>
                                  reject(
                                    order
                                  )
                                }
                              >
                                ✕ Reject
                              </button>

                              <button
                                type="button"
                                className="action accept"
                                onClick={() =>
                                  accept(
                                    order
                                  )
                                }
                              >
                                ✓ Accept Order
                              </button>

                            </div>
                          ) : (
                            <div
                              className="rejected"
                              style={{
                                color:
                                  "#dc2626"
                              }}
                            >
                              Time expired ·
                              Cancelling...
                            </div>
                          )}
                        </>
                      )}

                      {/* PREPARING */}
                      {status ===
                        "Preparing" && (
                        <>
                          <div
                            className={`timer preparation ${
                              expired
                                ? "expired"
                                : ""
                            }`}
                          >
                            <span>
                              {expired
                                ? "Time completed"
                                : "Kitchen Timer"}
                            </span>

                            <strong>
                              {remaining(
                                order
                              )}
                            </strong>
                          </div>

                          <div className="action-row">

                            <button
                              className="action extra"
                              onClick={() =>
                                extra(
                                  order
                                )
                              }
                            >
                              +10 Min
                            </button>

                            <button
                              className="action ready"
                              onClick={() =>
                                ready(
                                  order
                                )
                              }
                            >
                              Mark Ready
                            </button>

                          </div>
                        </>
                      )}

                      {/* FOOD READY */}
                      {status ===
                        "Food Ready" && (
                        <button
                          className="action dispatch"
                          onClick={() =>
                            dispatch(
                              order
                            )
                          }
                        >
                          🛵 Dispatch
                        </button>
                      )}

                      {/* DISPATCHED */}
                      {status ===
                        "Dispatched" && (
                        <button
                          className="action ready"
                          onClick={() =>
                            delivered(
                              order
                            )
                          }
                        >
                          ✓ Mark Delivered
                        </button>
                      )}

                      {/* REJECTED */}
                      {status ===
                        "Rejected" && (
                        <div className="rejected">
                          Rejected ·{" "}
                          {order.rejectionReason ||
                            "Staff rejected"}
                        </div>
                      )}

                      {/* CANCELLED */}
                      {status ===
                        "Cancelled" && (
                        <div
                          className="rejected"
                          style={{
                            color:
                              "#dc2626"
                          }}
                        >
                          Cancelled ·{" "}
                          {order.cancellationReason ||
                            "Order confirmation timeout"}
                        </div>
                      )}

                      {/* VIEW KOT
                          Never available before acceptance.
                      */}
                      {!waiting &&
                        status !==
                          "Rejected" &&
                        status !==
                          "Cancelled" && (
                          <button
                            className="action outline view-kot-btn"
                            onClick={() => {
                              stopBell();

                              setKotOrder(
                                order
                              );

                              if (
                                newOrder?.id ===
                                order.id
                              ) {
                                setNewOrder(
                                  null
                                );
                              }
                            }}
                          >
                            🧾 View KOT
                          </button>
                        )}

                      {/* UPI */}
                      {order.paymentMethod ===
                        "UPI Payment" &&
                        order.paymentStatus !==
                          "Paid" &&
                        status !==
                          "Rejected" &&
                        status !==
                          "Cancelled" && (
                          <button
                            className="action payment-btn"
                            onClick={() =>
                              verifyUpi(
                                order
                              )
                            }
                          >
                            💳 Mark UPI Paid
                          </button>
                        )}

                    </div>

                  </article>
                );
              }
            )}

          </div>
        )}

      </main>

      {/* ===================================================
          WAITING FOR CONFIRMATION POPUP
      =================================================== */}

      {newOrder &&
        isWaitingForConfirmation(
          newOrder
        ) && (
          <div className="new-order-overlay">

            <div className="new-order-alert">

              <button
                className="alert-close"
                onClick={() => {
                  stopBell();

                  setNewOrder(
                    null
                  );
                }}
              >
                ×
              </button>

              <div className="new-icon">
                🔔
              </div>

              <div>

                <span>
                  WAITING FOR STORE CONFIRMATION
                </span>

                <h2>
                  Order #{label(
                    newOrder
                  )}
                </h2>

                <p>
                  {newOrder.customerName ||
                    newOrder.name ||
                    "Customer"}{" "}
                  ·{" "}
                  {money(
                    newOrder.total
                  )}
                </p>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 28,
                    fontWeight: 900,
                    color:
                      confirmationRemaining(
                        newOrder,
                        now
                      ) > 0
                        ? "#ea580c"
                        : "#dc2626"
                  }}
                >
                  {confirmationTimeLabel(
                    newOrder,
                    now
                  )}
                </div>

                {getDailyScratchReward(
                  newOrder
                )?.enabled && (
                  <div
                    style={{
                      marginTop: 8,
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: 6,
                      padding:
                        "6px 9px",
                      borderRadius: 8,
                      background:
                        "#fff7ed",
                      border:
                        "1px solid #fed7aa",
                      color:
                        "#9a3412",
                      fontSize: 12,
                      fontWeight: 800
                    }}
                  >
                    🎁{" "}
                    {getDailyScratchRewardText(
                      newOrder
                    )}
                  </div>
                )}

              </div>

              <div className="alert-actions">

                {confirmationRemaining(
                  newOrder,
                  now
                ) > 0 ? (
                  <>
                    <button
                      className="action accept big"
                      onClick={() =>
                        accept(
                          newOrder
                        )
                      }
                    >
                      ✓ ACCEPT ORDER
                    </button>

                    <button
                      className="action reject big"
                      onClick={() =>
                        reject(
                          newOrder
                        )
                      }
                    >
                      ✕ REJECT
                    </button>
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      textAlign:
                        "center",
                      padding: 12,
                      color:
                        "#dc2626",
                      fontWeight: 800
                    }}
                  >
                    ⏰ Confirmation time
                    expired. Order is
                    being cancelled...
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      {/* ===================================================
          KOT MODAL
      =================================================== */}

      <KOTModal
        order={kotOrder}
        onClose={() => {
          stopBell();

          setKotOrder(
            null
          );
        }}
        onPrint={
          printKOT
        }
      />

    </div>
  );
}

export default AdminOrders;
