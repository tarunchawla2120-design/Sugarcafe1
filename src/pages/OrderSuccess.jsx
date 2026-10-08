import { useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { db } from "../firebase";
import "./OrderSuccess.css";

const LOYALTY_REWARDS = [
  "Classic Cold Coffee",
  "Cheese Aloo Tikki Burger",
  "Aloo Cheese Puff",
  "Paneer Cheese Sandwich",
  "Diet Coke",
  "Salted French Fries",
  "Hot Chocolate Brownie",
  "Hot Chocolava",
];

function OrderSuccess() {
  const navigate = useNavigate();

  const [orderNumber, setOrderNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("New");
  const [loading, setLoading] = useState(true);
  const [orderExists, setOrderExists] = useState(false);

  // ============================================
  // CANCELLATION ALERT
  // ============================================

  const [cancellationAlert, setCancellationAlert] =
    useState(null);

  const cancellationAudioRef = useRef(null);

  // ============================================
  // SAME 6TH ORDER SUGAR REWARD
  // ============================================

  const [loyaltyRewardPending, setLoyaltyRewardPending] =
    useState(false);

  const [loyaltyReward, setLoyaltyReward] =
    useState("");

  const [loyaltyRewardClaimed, setLoyaltyRewardClaimed] =
    useState(false);

  const [redeemingReward, setRedeemingReward] =
    useState(false);

  // ============================================
  // STOP CANCELLATION BUZZER
  // ============================================

  const stopCancellationBuzzer = () => {
    try {
      if (cancellationAudioRef.current) {
        cancellationAudioRef.current.pause();
        cancellationAudioRef.current.currentTime = 0;
        cancellationAudioRef.current = null;
      }
    } catch (error) {
      console.error(
        "Cancellation buzzer stop error:",
        error
      );
    }
  };

  // ============================================
  // START CANCELLATION BUZZER
  // ============================================

  const startCancellationBuzzer = () => {
    try {
      stopCancellationBuzzer();

      const audio = new Audio(
        "/order-cancelled.mp3"
      );

      audio.loop = true;
      audio.volume = 1;

      cancellationAudioRef.current = audio;

      audio.play().catch((error) => {
        console.warn(
          "Cancellation buzzer could not autoplay:",
          error
        );
      });
    } catch (error) {
      console.error(
        "Cancellation buzzer error:",
        error
      );
    }
  };

  // ============================================
  // REALTIME ORDER
  // ============================================

  useEffect(() => {
    const savedOrderId =
      localStorage.getItem("lastOrderId") || "";

    const savedOrderNumber =
      localStorage.getItem("lastOrderNumber") || "";

    const savedPaymentStatus =
      localStorage.getItem(
        "lastOrderPaymentStatus"
      ) || "";

    setOrderNumber(savedOrderNumber);
    setPaymentStatus(savedPaymentStatus);

    if (!savedOrderId) {
      setLoading(false);
      return;
    }

    const orderRef = doc(
      db,
      "orders",
      savedOrderId
    );

    const unsubscribe = onSnapshot(
      orderRef,
      (snapshot) => {
        setLoading(false);

        if (!snapshot.exists()) {
          setOrderExists(false);
          return;
        }

        setOrderExists(true);

        const data = snapshot.data();

        const currentStatus = String(
          data.status || ""
        ).toUpperCase();

        const confirmationStatus = String(
          data.confirmationStatus || ""
        ).toUpperCase();

        setOrderNumber(
          data.orderNumber ||
            savedOrderNumber ||
            ""
        );

        setPaymentStatus(
          data.paymentStatus ||
            savedPaymentStatus ||
            ""
        );

        setOrderStatus(
          data.status || "New"
        );

        // ========================================
        // CANCELLATION / REJECTION DETECTION
        // ========================================

        const isCancelled =
          currentStatus === "CANCELLED" ||
          confirmationStatus === "AUTO_CANCELLED";

        const isRejected =
          currentStatus === "REJECTED" ||
          confirmationStatus === "REJECTED";

        if (isCancelled || isRejected) {
          const storageKey =
            `sugarCafeCancellationShown:${savedOrderId}`;

          const alreadyShown =
            sessionStorage.getItem(storageKey);

          if (!alreadyShown) {
            sessionStorage.setItem(
              storageKey,
              "true"
            );

            const reason =
              data.cancellationReason ||
              data.rejectionReason ||
              (
                isRejected
                  ? "Your order was rejected by Sugar Café."
                  : "Your order was cancelled because the café did not confirm it within 60 seconds."
              );

            setCancellationAlert({
              type: isRejected
                ? "REJECTED"
                : "CANCELLED",

              orderNumber:
                data.orderNumber ||
                savedOrderNumber ||
                savedOrderId,

              reason,
            });

            // 🔔 START BUZZER
            startCancellationBuzzer();
          }
        }

        // ========================================
        // SUGAR REWARD STATE
        // ========================================

        setLoyaltyRewardPending(
          data.loyaltyRewardPending === true
        );

        setLoyaltyReward(
          data.loyaltyReward ||
            data.loyaltyRewardItem ||
            ""
        );

        setLoyaltyRewardClaimed(
          data.loyaltyRewardClaimed === true
        );
      },
      (error) => {
        console.error(
          "Order status listener error:",
          error
        );

        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      stopCancellationBuzzer();
    };
  }, []);

  // ============================================
  // CLEANUP BUZZER WHEN PAGE CLOSES
  // ============================================

  useEffect(() => {
    return () => {
      stopCancellationBuzzer();
    };
  }, []);

  // ============================================
  // CLOSE CANCELLATION POPUP
  // ============================================

  const closeCancellationAlert = () => {
    stopCancellationBuzzer();
    setCancellationAlert(null);
  };

  // ============================================
  // REVEAL SUGAR REWARD
  // ADD FREE ITEM TO SAME 6TH ORDER
  // ============================================

  const revealLoyaltyReward = async () => {
    const savedOrderId =
      localStorage.getItem("lastOrderId") || "";

    if (
      !savedOrderId ||
      !loyaltyRewardPending ||
      loyaltyRewardClaimed ||
      redeemingReward
    ) {
      return;
    }

    setRedeemingReward(true);

    try {
      const orderRef = doc(
        db,
        "orders",
        savedOrderId
      );

      // Re-read order before update
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        throw new Error("Order not found.");
      }

      const orderData = orderSnap.data();

      // Prevent duplicate reward
      if (
        orderData.loyaltyRewardClaimed === true ||
        orderData.loyaltyRewardPending === false
      ) {
        setLoyaltyReward(
          orderData.loyaltyReward ||
            orderData.loyaltyRewardItem ||
            ""
        );

        setLoyaltyRewardClaimed(true);
        setLoyaltyRewardPending(false);

        return;
      }

      // ========================================
      // RANDOM FREE REWARD
      // ========================================

      const reward =
        LOYALTY_REWARDS[
          Math.floor(
            Math.random() *
              LOYALTY_REWARDS.length
          )
        ];

      const existingItems =
        Array.isArray(orderData.items)
          ? orderData.items
          : [];

      // Safety check
      const alreadyAdded = existingItems.some(
        (item) =>
          item?.reward === true &&
          item?.rewardType === "loyalty"
      );

      if (alreadyAdded) {
        setLoyaltyReward(
          orderData.loyaltyReward ||
            reward
        );

        setLoyaltyRewardClaimed(true);
        setLoyaltyRewardPending(false);

        return;
      }

      // ========================================
      // FREE ITEM
      // ========================================

      const rewardItem = {
        id: `loyalty-reward-${Date.now()}`,

        name: `🎁 FREE ${reward}`,

        price: 0,

        qty: 1,

        image: "",

        category: "Sugar Rewards",

        reward: true,

        rewardType: "loyalty",
      };

      // ========================================
      // UPDATE SAME 6TH ORDER
      // ========================================

      await updateDoc(orderRef, {
        items: [
          ...existingItems,
          rewardItem,
        ],

        loyaltyReward: reward,

        loyaltyRewardItem: reward,

        loyaltyRewardClaimed: true,

        loyaltyRewardRedeemed: true,

        loyaltyRewardPending: false,

        loyaltyRewardClaimedAt:
          Timestamp.now(),

        loyaltyRewardPrice: 0,
      });

      setLoyaltyReward(reward);

      setLoyaltyRewardClaimed(true);

      setLoyaltyRewardPending(false);
    } catch (error) {
      console.error(
        "Loyalty reward error:",
        error
      );

      alert(
        "Reward reveal nahi ho paya. Please try again."
      );
    } finally {
      setRedeemingReward(false);
    }
  };

  // ============================================
  // STATUS
  // ============================================

  const isWaiting =
    orderStatus === "New" ||
    orderStatus === "Order Placed" ||
    orderStatus === "Pending" ||
    orderStatus === "WAITING_FOR_CONFIRMATION";

  const isAccepted =
    orderStatus === "Preparing" ||
    orderStatus === "Food Ready" ||
    orderStatus === "Ready" ||
    orderStatus === "Dispatched" ||
    orderStatus === "Delivered";

  const isRejected =
    orderStatus === "Rejected";

  const isCancelled =
    String(orderStatus).toUpperCase() ===
    "CANCELLED";

  // ============================================
  // REWARD UI
  // ============================================

  const renderSugarReward = () => {
    if (
      loyaltyRewardPending &&
      !loyaltyRewardClaimed
    ) {
      return (
        <div className="loyalty-success-card">
          <div className="loyalty-success-icon">
            🎁
          </div>

          <span className="loyalty-success-label">
            6TH ORDER REWARD
          </span>

          <h3>
            You unlocked a Sugar Reward!
          </h3>

          <p>
            Your 6th ₹500+ qualifying order
            is complete.
            <br />
            Reveal your FREE reward now.
          </p>

          <button
            type="button"
            className="loyalty-scratch-button"
            onClick={revealLoyaltyReward}
            disabled={redeemingReward}
          >
            {redeemingReward
              ? "REVEALING..."
              : "🎁 SCRATCH & REVEAL"}
          </button>
        </div>
      );
    }

    if (
      loyaltyRewardClaimed &&
      loyaltyReward
    ) {
      return (
        <div className="loyalty-success-card reward-revealed">
          <div className="reward-confetti">
            ✨ 🎉 ✨
          </div>

          <div className="loyalty-success-icon">
            🎁
          </div>

          <span className="loyalty-success-label">
            CONGRATULATIONS!
          </span>

          <h3>
            FREE {loyaltyReward}
          </h3>

          <p>
            Your Sugar Reward has been added
            FREE to this same 6th order.
          </p>

          <div className="reward-added-badge">
            ✓ ₹0 REWARD ADDED
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================================
  // WAITING
  // ============================================

  const renderWaiting = () => (
    <>
      <div
        className="success-icon"
        style={{
          background: "#fff7ed",
          color: "#f97316",
        }}
      >
        🕐
      </div>

      <h2>
        Order Received
      </h2>

      <p>
        Your order has been sent to
        <br />
        <strong>Sugar Café</strong>.
        <br />
        <br />
        Please wait while our staff
        confirms your order.
      </p>

      <div
        style={{
          margin: "16px 0",
          padding: "14px",
          borderRadius: "12px",
          background: "#fff7ed",
          border: "1px solid #fed7aa",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#9a3412",
            marginBottom: "5px",
          }}
        >
          ORDER NUMBER
        </div>

        <strong
          style={{
            fontSize: "18px",
          }}
        >
          {orderNumber || "Processing..."}
        </strong>

        <div
          style={{
            marginTop: "8px",
            color: "#ea580c",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          🟠 Waiting for Café Confirmation
        </div>
      </div>

      {paymentStatus && (
        <div
          style={{
            fontSize: "13px",
            color: "#666",
            marginBottom: "12px",
          }}
        >
          Payment:{" "}
          <strong>
            {paymentStatus}
          </strong>
        </div>
      )}

      {renderSugarReward()}

      <p
        style={{
          fontSize: "12px",
          color: "#888",
        }}
      >
        This page will update automatically
        when the café accepts your order.
      </p>
    </>
  );

  // ============================================
  // ACCEPTED
  // ============================================

  const renderAccepted = () => (
    <>
      <div
        className="success-icon"
        style={{
          background: "#ecfdf5",
          color: "#16a34a",
        }}
      >
        ✅
      </div>

      <h2>
        Order Confirmed!
      </h2>

      <p>
        Sugar Café has accepted your order.
        <br />

        {orderStatus === "Preparing" ? (
          <strong>
            Your food is now being prepared.
          </strong>
        ) : (
          <>
            Your order is moving through the
            <br />
            kitchen and delivery process.
          </>
        )}
      </p>

      <div
        style={{
          margin: "16px 0",
          padding: "14px",
          borderRadius: "12px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#166534",
            marginBottom: "5px",
          }}
        >
          ORDER NUMBER
        </div>

        <strong
          style={{
            fontSize: "18px",
          }}
        >
          {orderNumber}
        </strong>

        <div
          style={{
            marginTop: "8px",
            color: "#15803d",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          🟢 {orderStatus}
        </div>
      </div>

      {paymentStatus && (
        <div
          style={{
            fontSize: "13px",
            color: "#666",
            marginBottom: "12px",
          }}
        >
          Payment:{" "}
          <strong>
            {paymentStatus}
          </strong>
        </div>
      )}

      {renderSugarReward()}
    </>
  );

  // ============================================
  // REJECTED
  // ============================================

  const renderRejected = () => (
    <>
      <div
        className="success-icon"
        style={{
          background: "#fef2f2",
          color: "#dc2626",
        }}
      >
        ❌
      </div>

      <h2>
        Order Rejected
      </h2>

      <p>
        Sorry, Sugar Café was unable to
        <br />
        accept your order.
      </p>

      <div
        style={{
          margin: "16px 0",
          padding: "14px",
          borderRadius: "12px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
        }}
      >
        <strong>
          {orderNumber}
        </strong>

        <div
          style={{
            marginTop: "8px",
            color: "#dc2626",
            fontSize: "13px",
            fontWeight: "600",
          }}
        >
          🔴 Order Rejected by Café
        </div>
      </div>

      {paymentStatus === "Paid" && (
        <p
          style={{
            fontSize: "12px",
            color: "#666",
          }}
        >
          Your online payment was received.
          Please contact Sugar Café regarding
          the payment/refund for this rejected
          order.
        </p>
      )}
    </>
  );

  // ============================================
  // CANCELLED
  // ============================================

  const renderCancelled = () => (
    <>
      <div
        className="success-icon"
        style={{
          background: "#fef2f2",
          color: "#dc2626",
        }}
      >
        🚫
      </div>

      <h2>
        Order Cancelled
      </h2>

      <p>
        We're sorry! Your order could not
        <br />
        be processed by Sugar Café.
      </p>

      <div
        style={{
          margin: "16px 0",
          padding: "14px",
          borderRadius: "12px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "#991b1b",
            marginBottom: "5px",
          }}
        >
          ORDER NUMBER
        </div>

        <strong
          style={{
            fontSize: "18px",
          }}
        >
          {orderNumber}
        </strong>

        <div
          style={{
            marginTop: "10px",
            color: "#dc2626",
            fontSize: "13px",
            fontWeight: "700",
          }}
        >
          🔴 Order Cancelled
        </div>
      </div>

      <div
        style={{
          padding: "12px",
          borderRadius: "10px",
          background: "#fff7f7",
          border: "1px solid #fee2e2",
          fontSize: "13px",
          color: "#555",
          lineHeight: "1.5",
        }}
      >
        <strong>
          Reason:
        </strong>

        <br />

        {cancellationAlert?.reason ||
          "The café did not confirm your order within the required time."}
      </div>

      {paymentStatus === "Paid" && (
        <p
          style={{
            marginTop: "12px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          Your online payment was received.
          Please contact Sugar Café regarding
          the payment/refund for this cancelled
          order.
        </p>
      )}
    </>
  );

  // ============================================
  // LOADING
  // ============================================

  if (loading) {
    return (
      <div className="success-page">
        <div className="success-card">
          <div
            className="success-icon"
            style={{
              background: "#fff7ed",
            }}
          >
            🕐
          </div>

          <h2>
            Checking Your Order...
          </h2>

          <p>
            Please wait while we load your
            order status.
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // PAGE
  // ============================================

  return (
    <div className="success-page">
      <div className="success-card">

        {!orderExists ? (
          <>
            <div className="success-icon">
              ✅
            </div>

            <h2>
              Order Received
            </h2>

            <p>
              Your order has been submitted
              successfully.
            </p>

            {orderNumber && (
              <div
                style={{
                  margin: "16px 0",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#fff7ed",
                }}
              >
                <strong>
                  {orderNumber}
                </strong>
              </div>
            )}
          </>
        ) : isCancelled ? (
          renderCancelled()
        ) : isRejected ? (
          renderRejected()
        ) : isWaiting ? (
          renderWaiting()
        ) : isAccepted ? (
          renderAccepted()
        ) : (
          renderWaiting()
        )}

        <button
          className="home-btn"
          onClick={() =>
            navigate("/orders")
          }
        >
          📦 Track My Order
        </button>

        <button
          className="home-btn"
          style={{
            marginTop: "10px",
            background: "#fff",
            color: "#ff6b35",
            border: "1px solid #ff6b35",
          }}
          onClick={() =>
            navigate("/home")
          }
        >
          Back to Home
        </button>

      </div>

      {/* =========================================
          CANCELLATION / REJECTION POPUP
      ========================================= */}

      {cancellationAlert && (
        <div className="order-cancel-overlay">
          <div className="order-cancel-popup">

            <div className="cancel-buzzer-icon">
              {cancellationAlert.type ===
              "REJECTED"
                ? "❌"
                : "🔔"}
            </div>

            <div className="cancel-title">
              {cancellationAlert.type ===
              "REJECTED"
                ? "Order Rejected"
                : "Order Cancelled"}
            </div>

            <div className="cancel-order-number">
              Order #{cancellationAlert.orderNumber}
            </div>

            <div className="cancel-message">
              {cancellationAlert.type ===
              "REJECTED"
                ? "😔 Sorry! Sugar Café could not accept your order."
                : "😔 Sorry! Your order was cancelled because it could not be confirmed in time."}
            </div>

            <div className="cancel-reason">
              <strong>
                Reason
              </strong>

              <p>
                {cancellationAlert.reason}
              </p>
            </div>

            {paymentStatus === "Paid" && (
              <div className="cancel-payment-warning">
                💳 Your online payment was received.
                <br />
                Please contact Sugar Café regarding
                your refund.
              </div>
            )}

            <button
              type="button"
              className="cancel-popup-ok"
              onClick={
                closeCancellationAlert
              }
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderSuccess;
