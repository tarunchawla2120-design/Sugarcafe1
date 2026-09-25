import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  doc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";
import "./SugarCafeRewardCard.css";

/* =========================================================
   HELPERS
========================================================= */

function getTime(value) {
  if (!value) return 0;

  if (value?.toMillis) {
    return value.toMillis();
  }

  if (value?.toDate) {
    return value.toDate().getTime();
  }

  const parsed =
    new Date(value).getTime();

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}

function getRewardTitle(reward) {
  if (!reward) {
    return "YOUR REWARD";
  }

  if (
    reward.type === "discount"
  ) {
    return `${reward.discountPercent || 5}% OFF`;
  }

  return reward.itemName
    ? `FREE ${String(
        reward.itemName
      ).toUpperCase()}`
    : "FREE ITEM";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function SugarCafeRewardCard({
  orders = [],
  customerId = "",
  activeRewardOrder = null,
  qualifyingOrders = [],
  qualifyingCount = 0,
  loyaltyProgress = 0,
  loyaltyCycle = 0,
  nextCycle = 1,
  scratchCardUnlocked = false,
}) {
  const canvasRef = useRef(null);
  const scratchAreaRef = useRef(null);

  const isDrawingRef =
    useRef(false);

  const lastPointRef =
    useRef(null);

  const revealingRef =
    useRef(false);

  const [scratchProgress, setScratchProgress] =
    useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [celebrate, setCelebrate] =
    useState(false);

  const [savingReveal, setSavingReveal] =
    useState(false);

  /* =======================================================
     ACTIVE REWARD
  ======================================================= */

  const rewardOrder =
    activeRewardOrder || null;

  const reward =
    rewardOrder?.loyaltyReward ||
    null;

  const hasReward =
    Boolean(
      rewardOrder &&
      reward
    );

  const rewardStatus =
    reward?.status || "";

  /* =======================================================
     REWARD IMAGE / NAME
  ======================================================= */

  const rewardImage =
    reward?.itemImage ||
    reward?.image ||
    reward?.imageUrl ||
    "";

  const rewardItemName =
    reward?.itemName ||
    "Reward Item";

  const rewardTitle =
    getRewardTitle(reward);

  /* =======================================================
     EXISTING REWARD STATUS
     
     available = already scratched
     scratch_pending = needs scratching
  ======================================================= */

  useEffect(() => {
    if (
      hasReward &&
      rewardStatus === "available"
    ) {
      setRevealed(true);
      setScratchProgress(100);
    } else {
      setRevealed(false);
      setScratchProgress(0);
    }

    revealingRef.current =
      false;
  }, [
    hasReward,
    rewardStatus,
    rewardOrder?.id,
  ]);

  /* =======================================================
     DRAW SCRATCH SURFACE
  ======================================================= */

  const drawScratchSurface =
    () => {
      const canvas =
        canvasRef.current;

      const area =
        scratchAreaRef.current;

      if (
        !canvas ||
        !area ||
        revealed
      ) {
        return;
      }

      const rect =
        area.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }

      const dpr =
        window.devicePixelRatio || 1;

      canvas.width =
        Math.floor(
          rect.width * dpr
        );

      canvas.height =
        Math.floor(
          rect.height * dpr
        );

      canvas.style.width =
        `${rect.width}px`;

      canvas.style.height =
        `${rect.height}px`;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) return;

      /*
        IMPORTANT:
        Reset transform before scaling.
        This prevents the canvas from
        becoming blurry after resize.
      */

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      /* ===================================================
         METALLIC BASE
      =================================================== */

      const gradient =
        ctx.createLinearGradient(
          0,
          0,
          rect.width,
          rect.height
        );

      gradient.addColorStop(
        0,
        "#b8b8b8"
      );

      gradient.addColorStop(
        0.18,
        "#eeeeee"
      );

      gradient.addColorStop(
        0.38,
        "#c5c5c5"
      );

      gradient.addColorStop(
        0.52,
        "#f6f6f6"
      );

      gradient.addColorStop(
        0.72,
        "#bcbcbc"
      );

      gradient.addColorStop(
        1,
        "#dedede"
      );

      ctx.globalCompositeOperation =
        "source-over";

      ctx.globalAlpha = 1;

      ctx.fillStyle =
        gradient;

      ctx.fillRect(
        0,
        0,
        rect.width,
        rect.height
      );

      /* ===================================================
         METALLIC TEXTURE
      =================================================== */

      for (
        let i = 0;
        i < 1200;
        i++
      ) {
        const x =
          Math.random() *
          rect.width;

        const y =
          Math.random() *
          rect.height;

        const alpha =
          Math.random() * 0.12;

        ctx.fillStyle =
          `rgba(255,255,255,${alpha})`;

        ctx.fillRect(
          x,
          y,
          1,
          1
        );
      }

      /* ===================================================
         DIAGONAL PATTERN
      =================================================== */

      ctx.save();

      ctx.globalAlpha =
        0.08;

      ctx.strokeStyle =
        "#ffffff";

      ctx.lineWidth = 1;

      for (
        let x = -rect.height;
        x < rect.width;
        x += 18
      ) {
        ctx.beginPath();

        ctx.moveTo(
          x,
          0
        );

        ctx.lineTo(
          x + rect.height,
          rect.height
        );

        ctx.stroke();
      }

      ctx.restore();

      /* ===================================================
         CENTER TEXT
      =================================================== */

      ctx.save();

      ctx.globalAlpha =
        0.25;

      ctx.fillStyle =
        "#ffffff";

      ctx.textAlign =
        "center";

      ctx.textBaseline =
        "middle";

      ctx.font =
        "900 18px Arial";

      ctx.fillText(
        "SUGARCAFE",
        rect.width / 2,
        rect.height / 2 - 18
      );

      ctx.font =
        "700 12px Arial";

      ctx.fillText(
        "SCRATCH TO REVEAL",
        rect.width / 2,
        rect.height / 2 + 10
      );

      ctx.restore();
    };

  /* =======================================================
     INITIALIZE CANVAS
  ======================================================= */

  useEffect(() => {
    if (
      !hasReward ||
      rewardStatus !==
        "scratch_pending" ||
      revealed
    ) {
      return;
    }

    const timer =
      setTimeout(
        drawScratchSurface,
        100
      );

    window.addEventListener(
      "resize",
      drawScratchSurface
    );

    return () => {
      clearTimeout(timer);

      window.removeEventListener(
        "resize",
        drawScratchSurface
      );
    };
  }, [
    hasReward,
    rewardStatus,
    revealed,
  ]);

  /* =======================================================
     GET POINTER POSITION
  ======================================================= */

  const getPoint = (
    event
  ) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        event.clientX -
        rect.left,

      y:
        event.clientY -
        rect.top,
    };
  };

  /* =======================================================
     CALCULATE SCRATCH %
  ======================================================= */

  const calculateScratchProgress =
    () => {
      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      /*
        Sample the alpha channel.
      */

      const width =
        canvas.width;

      const height =
        canvas.height;

      if (
        width <= 0 ||
        height <= 0
      ) {
        return;
      }

      const imageData =
        ctx.getImageData(
          0,
          0,
          width,
          height
        );

      const data =
        imageData.data;

      let transparent =
        0;

      let sampled =
        0;

      /*
        Sample every 16th pixel.
      */

      const step = 16;

      for (
        let i = 3;
        i < data.length;
        i +=
          4 * step
      ) {
        sampled++;

        if (
          data[i] < 80
        ) {
          transparent++;
        }
      }

      if (
        sampled <= 0
      ) {
        return;
      }

      const percentage =
        Math.min(
          100,
          Math.round(
            (transparent /
              sampled) *
              100
          )
        );

      setScratchProgress(
        percentage
      );

      /*
        58% scratch completed.
      */

      if (
        percentage >= 58
      ) {
        revealReward();
      }
    };

  /* =======================================================
     SAVE REVEAL TO FIRESTORE
  ======================================================= */

  const revealReward =
    async () => {
      if (
        revealingRef.current ||
        revealed ||
        !rewardOrder?.id ||
        rewardStatus !==
          "scratch_pending"
      ) {
        return;
      }

      revealingRef.current =
        true;

      setSavingReveal(true);

      try {
        /*
          IMPORTANT:
          Only change the reward state.

          We DO NOT:
          - redeem the reward
          - apply the reward
          - modify the order total
        */

        await updateDoc(
          doc(
            db,
            "orders",
            rewardOrder.id
          ),
          {
            "loyaltyReward.status":
              "available",

            "loyaltyReward.scratchPending":
              false,

            "loyaltyReward.scratchRevealed":
              true,

            "loyaltyReward.revealedAt":
              Timestamp.now(),
          }
        );

        setScratchProgress(
          100
        );

        setRevealed(true);

        setCelebrate(true);

        if (
          window.navigator?.vibrate
        ) {
          window.navigator.vibrate(
            [30, 40, 60]
          );
        }

        setTimeout(() => {
          setCelebrate(false);
        }, 2200);
      } catch (error) {
        console.error(
          "Scratch reward reveal failed:",
          error
        );

        revealingRef.current =
          false;

        /*
          If Firestore fails,
          don't tell customer that
          reward was successfully saved.
        */

        alert(
          "Reward reveal save nahi ho paya. Please try scratching again."
        );
      } finally {
        setSavingReveal(false);
      }
    };

  /* =======================================================
     SCRATCH
  ======================================================= */

  const scratchAt =
    (point) => {
      if (
        !point ||
        revealed ||
        savingReveal ||
        rewardStatus !==
          "scratch_pending"
      ) {
        return;
      }

      const canvas =
        canvasRef.current;

      if (!canvas) {
        return;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.save();

      ctx.globalCompositeOperation =
        "destination-out";

      ctx.lineCap =
        "round";

      ctx.lineJoin =
        "round";

      ctx.lineWidth =
        44;

      const previous =
        lastPointRef.current;

      if (previous) {
        ctx.beginPath();

        ctx.moveTo(
          previous.x,
          previous.y
        );

        ctx.lineTo(
          point.x,
          point.y
        );

        ctx.stroke();
      } else {
        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          22,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      ctx.restore();

      lastPointRef.current =
        point;

      calculateScratchProgress();
    };

  /* =======================================================
     POINTER DOWN
  ======================================================= */

  const handlePointerDown =
    (event) => {
      if (
        revealed ||
        savingReveal ||
        rewardStatus !==
          "scratch_pending"
      ) {
        return;
      }

      event.preventDefault();

      /*
        Allows smooth mobile scratching.
      */

      if (
        event.currentTarget?.setPointerCapture
      ) {
        try {
          event.currentTarget.setPointerCapture(
            event.pointerId
          );
        } catch {
          // ignore
        }
      }

      isDrawingRef.current =
        true;

      lastPointRef.current =
        null;

      const point =
        getPoint(event);

      scratchAt(point);
    };

  /* =======================================================
     POINTER MOVE
  ======================================================= */

  const handlePointerMove =
    (event) => {
      if (
        !isDrawingRef.current ||
        revealed ||
        savingReveal
      ) {
        return;
      }

      event.preventDefault();

      const point =
        getPoint(event);

      scratchAt(point);
    };

  /* =======================================================
     STOP SCRATCH
  ======================================================= */

  const stopScratch =
    (event) => {
      isDrawingRef.current =
        false;

      lastPointRef.current =
        null;

      if (
        event?.currentTarget
          ?.releasePointerCapture
      ) {
        try {
          event.currentTarget.releasePointerCapture(
            event.pointerId
          );
        } catch {
          // ignore
        }
      }
    };

  /* =======================================================
     NO CUSTOMER
  ======================================================= */

  if (!customerId) {
    return null;
  }

  /* =======================================================
     ACTIVE SCRATCH CARD
  ======================================================= */

  if (hasReward) {
    /*
      IMPORTANT:
      A reward that is already applied should
      never appear as an active scratch card.

      Orders.jsx already filters this,
      but this extra protection is intentional.
    */

    if (
      rewardStatus !==
        "scratch_pending" &&
      rewardStatus !==
        "available"
    ) {
      return null;
    }

    const isAlreadyRevealed =
      rewardStatus ===
      "available";

    const showRevealed =
      revealed ||
      isAlreadyRevealed;

    return (
      <div
        className={`sugar-reward-card premium-reward-card ${
          showRevealed
            ? "is-revealed"
            : ""
        }`}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="reward-card-top">

          <div className="reward-brand">

            <div className="reward-brand-icon">
              🎁
            </div>

            <div>
              <strong>
                SugarCafe Rewards
              </strong>

              <small>
                6 + 1 Loyalty Program
              </small>
            </div>

          </div>

          <div className="reward-cycle-badge">
            CYCLE{" "}
            {reward?.cycle || 1}
          </div>

        </div>

        {/* =================================================
            SCRATCH INTRO
        ================================================= */}

        {!showRevealed && (
          <div className="scratch-intro">

            <div className="scratch-sparkle">
              ✨
            </div>

            <h2>
              Your Scratch Card Is Here!
            </h2>

            <p>
              Scratch the card below
              to reveal your reward.
            </p>

          </div>
        )}

        {/* =================================================
            SCRATCH AREA
        ================================================= */}

        <div
          ref={scratchAreaRef}
          className={`scratch-area ${
            showRevealed
              ? "scratch-revealed"
              : ""
          }`}
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            stopScratch
          }
          onPointerCancel={
            stopScratch
          }
          onPointerLeave={
            stopScratch
          }
          style={{
            touchAction:
              "none",
          }}
        >

          {/* =============================================
              REWARD UNDERLAY

              Actual reward remains hidden beneath
              the scratch layer.
          ============================================== */}

          <div className="reward-underlay">

            {rewardImage ? (
              <img
                src={rewardImage}
                alt={rewardItemName}
                className="reward-item-image"
              />
            ) : (
              <div className="reward-item-placeholder">
                🎁
              </div>
            )}

            <div className="reward-underlay-content">

              <span>
                CONGRATULATIONS
              </span>

              <strong>
                {rewardTitle}
              </strong>

              {reward?.type ===
              "discount" ? (
                <small>
                  {
                    reward?.discountPercent ||
                    5
                  }
                  % discount reward
                </small>
              ) : (
                <small>
                  Enjoy your complimentary{" "}
                  {rewardItemName}
                </small>
              )}

            </div>

          </div>

          {/* =============================================
              CANVAS
          ============================================== */}

          {!showRevealed && (
            <canvas
              ref={canvasRef}
              className="scratch-canvas"
            />
          )}

          {/* =============================================
              SCRATCH INSTRUCTION
          ============================================== */}

          {!showRevealed && (
            <div className="scratch-center">

              <div className="scratch-hand">
                👆
              </div>

              <strong>
                SCRATCH HERE
              </strong>

              <small>
                Drag your finger
              </small>

              <div className="scratch-progress-pill">
                {scratchProgress}%
                {" "}
                revealed
              </div>

            </div>
          )}

          {/* =============================================
              REVEALED REWARD
          ============================================== */}

          {showRevealed && (
            <div className="revealed-reward">

              {celebrate && (
                <div className="reward-confetti">

                  <span>🎉</span>
                  <span>✨</span>
                  <span>🎊</span>
                  <span>⭐</span>
                  <span>🎉</span>
                  <span>✨</span>

                </div>
              )}

              <div className="revealed-check">
                ✓
              </div>

              {rewardImage && (
                <img
                  src={rewardImage}
                  alt={rewardItemName}
                  className="revealed-item-image"
                />
              )}

              <span>
                CONGRATULATIONS!
              </span>

              <strong>
                {rewardTitle}
              </strong>

              {reward?.type ===
              "discount" ? (
                <small>
                  Get{" "}
                  {
                    reward?.discountPercent ||
                    5
                  }
                  % OFF on your next order
                </small>
              ) : (
                <small>
                  Your complimentary{" "}
                  {rewardItemName} is saved
                  for your next order.
                </small>
              )}

            </div>
          )}

        </div>

        {/* =================================================
            SAVING
        ================================================= */}

        {savingReveal && (
          <div className="scratch-saving">

            <span className="scratch-saving-spinner">
              ⏳
            </span>

            <span>
              Saving your reward...
            </span>

          </div>
        )}

        {/* =================================================
            HELP
        ================================================= */}

        {!showRevealed && (
          <div className="scratch-help">

            <span>
              ☝️
            </span>

            <div>

              <strong>
                Scratch with your finger
              </strong>

              <small>
                Reveal 58% or more to
                unlock your reward
              </small>

            </div>

          </div>
        )}

        {/* =================================================
            REVEALED / NEXT ORDER INFO
        ================================================= */}

        {showRevealed && (
          <div className="reward-redeem-box">

            <div className="redeem-icon">
              🎁
            </div>

            <div className="redeem-text">

              <strong>
                Reward saved for your next order
              </strong>

              <span>
                Reward: {rewardTitle}
              </span>

              {rewardOrder?.orderNumber && (
                <small>
                  Reward Card: #
                  {rewardOrder.orderNumber}
                </small>
              )}

            </div>

            <div className="redeem-status">
              READY
            </div>

          </div>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="reward-card-footer">

          <span>
            🎁 6 + 1 Rewards
          </span>

          <span>
            {showRevealed
              ? "Use on your next order"
              : "Scratch to reveal"}
          </span>

        </div>

      </div>
    );
  }

  /* =======================================================
     NO ACTIVE REWARD
     
     Show current progress.
  ======================================================= */

  const currentProgress =
    Math.max(
      0,
      Math.min(
        Number.isFinite(
          Number(loyaltyProgress)
        )
          ? Number(loyaltyProgress)
          : 0,
        6
      )
    );

  const remaining =
    Math.max(
      0,
      6 - currentProgress
    );

  /* =======================================================
     WAITING FOR 6 QUALIFYING ORDERS
  ======================================================= */

  if (currentProgress < 6) {
    return (
      <div className="sugar-reward-card">

        <div className="reward-card-top">

          <div className="reward-brand">

            <div className="reward-brand-icon">
              🎁
            </div>

            <div>

              <strong>
                SugarCafe Rewards
              </strong>

              <small>
                6 + 1 Loyalty Program
              </small>

            </div>

          </div>

          <div className="reward-badge">
            {currentProgress}/6
          </div>

        </div>

        <div className="reward-main">

          <div className="reward-gift">
            🎁
          </div>

          <h2>
            {remaining}{" "}
            qualifying order
            {remaining !== 1
              ? "s"
              : ""}{" "}
            to go!
          </h2>

          <p>
            Complete 6 delivered orders
            of ₹500+ each to unlock
            your 7th-order Scratch Card.
          </p>

          <div className="reward-progress-track">

            <div
              className="reward-progress-fill"
              style={{
                width: `${
                  (currentProgress /
                    6) *
                  100
                }%`,
              }}
            />

          </div>

          <div className="reward-progress-text">

            <span>
              {currentProgress}/6
            </span>

            <span>
              ₹500+ per bill
            </span>

          </div>

        </div>

        <div className="reward-card-footer">

          <span>
            🎉 Keep ordering
          </span>

          <span>
            🎁 7th order = Scratch Card
          </span>

        </div>

      </div>
    );
  }

  /* =======================================================
     6/6 COMPLETE
     
     No scratch card source order yet.
     Tell customer to place next order.
  ======================================================= */

  return (
    <div className="sugar-reward-card reward-ready-card">

      <div className="reward-card-top">

        <div className="reward-brand">

          <div className="reward-brand-icon">
            🎁
          </div>

          <div>

            <strong>
              SugarCafe Rewards
            </strong>

            <small>
              6 + 1 Loyalty Program
            </small>

          </div>

        </div>

        <div className="reward-ready-badge">
          READY
        </div>

      </div>

      <div className="reward-main">

        <div className="reward-gift reward-gift-large">
          🎁
        </div>

        <h2>
          Your Scratch Card Is Ready!
        </h2>

        <p>
          You completed 6 qualifying
          ₹500+ delivered orders.
        </p>

        <div className="reward-next-order">

          <span>
            7
          </span>

          <div>

            <strong>
              Place your 7th order
            </strong>

            <small>
              This order will unlock your
              Scratch Card. The reward will
              be available for your next
              order after scratching.
            </small>

          </div>

        </div>

      </div>

      <button
        type="button"
        className="reward-order-button"
        onClick={() => {
          window.location.href =
            "/menu";
        }}
      >
        ORDER NOW →
      </button>

      <div className="reward-card-footer">

        <span>
          🎁 6 + 1 Rewards
        </span>

        <span>
          Next order unlocks reward
        </span>

      </div>

    </div>
  );
}
