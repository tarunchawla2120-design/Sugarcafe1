import {
  useEffect,
  useRef,
  useState,
} from "react";
import "./SugarCafeRewardCard.css";

/* =========================================================
   HELPERS
========================================================= */

function getRewardFromOrders(orders = []) {
  const candidates = orders
    .filter((order) => order?.loyaltyReward)
    .sort((a, b) => {
      const getTime = (o) => {
        if (o?.createdAt?.toMillis) {
          return o.createdAt.toMillis();
        }

        if (o?.createdAt?.toDate) {
          return o.createdAt.toDate().getTime();
        }

        return new Date(o?.createdAt || 0).getTime() || 0;
      };

      return getTime(b) - getTime(a);
    });

  return candidates[0] || null;
}

function getRewardTitle(reward) {
  if (!reward) return "Your Reward";

  if (reward.type === "discount") {
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
}) {
  const canvasRef = useRef(null);
  const scratchAreaRef = useRef(null);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  /* =======================================================
     FIND ACTIVE REWARD
  ======================================================= */

  const rewardOrder =
    activeRewardOrder ||
    getRewardFromOrders(orders);

  const reward =
    rewardOrder?.loyaltyReward || null;

  const hasReward =
    Boolean(reward && rewardOrder);

  /* =======================================================
     QUALIFYING PROGRESS
  ======================================================= */

  const qualifyingCount =
    qualifyingOrders?.length ||
    0;

  const completedCycles = Math.floor(
    qualifyingCount / 6
  );

  const progressInCycle =
    qualifyingCount % 6;

  const ordersUntilReward =
    progressInCycle === 0
      ? 0
      : 6 - progressInCycle;

  /* =======================================================
     REWARD IMAGE
  ======================================================= */

  const rewardImage =
    reward?.itemImage ||
    reward?.image ||
    "";

  const rewardItemName =
    reward?.itemName ||
    "Reward Item";

  const rewardTitle =
    getRewardTitle(reward);

  /* =======================================================
     DRAW SCRATCH SURFACE
  ======================================================= */

  const drawScratchSurface = () => {
    const canvas = canvasRef.current;
    const area = scratchAreaRef.current;

    if (!canvas || !area) return;

    const rect =
      area.getBoundingClientRect();

    const dpr =
      window.devicePixelRatio || 1;

    canvas.width =
      rect.width * dpr;

    canvas.height =
      rect.height * dpr;

    canvas.style.width =
      `${rect.width}px`;

    canvas.style.height =
      `${rect.height}px`;

    const ctx =
      canvas.getContext("2d");

    ctx.scale(dpr, dpr);

    /* Premium metallic scratch surface */

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        rect.width,
        rect.height
      );

    gradient.addColorStop(
      0,
      "#c9c9c9"
    );

    gradient.addColorStop(
      0.25,
      "#f1f1f1"
    );

    gradient.addColorStop(
      0.5,
      "#bdbdbd"
    );

    gradient.addColorStop(
      0.75,
      "#eeeeee"
    );

    gradient.addColorStop(
      1,
      "#b4b4b4"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      rect.width,
      rect.height
    );

    /* Fine metallic texture */

    for (
      let i = 0;
      i < 900;
      i++
    ) {
      const x =
        Math.random() *
        rect.width;

      const y =
        Math.random() *
        rect.height;

      const alpha =
        Math.random() * 0.16;

      ctx.fillStyle =
        `rgba(255,255,255,${alpha})`;

      ctx.fillRect(
        x,
        y,
        1,
        1
      );
    }

    /* Premium pattern */

    ctx.globalAlpha = 0.18;

    ctx.fillStyle = "#ffffff";

    ctx.font =
      "bold 18px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
      "SUGARCAFE",
      rect.width / 2,
      rect.height / 2 - 15
    );

    ctx.font =
      "bold 12px Arial";

    ctx.fillText(
      "SCRATCH TO REVEAL",
      rect.width / 2,
      rect.height / 2 + 12
    );

    ctx.globalAlpha = 1;
  };

  /* =======================================================
     INITIALIZE CANVAS
  ======================================================= */

  useEffect(() => {
    if (!hasReward || revealed) {
      return;
    }

    const timer =
      setTimeout(
        drawScratchSurface,
        80
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
    revealed,
  ]);

  /* =======================================================
     SCRATCH POSITION
  ======================================================= */

  const getPoint = (event) => {
    const canvas =
      canvasRef.current;

    if (!canvas) return null;

    const rect =
      canvas.getBoundingClientRect();

    const source =
      event.touches?.[0] ||
      event.changedTouches?.[0] ||
      event;

    return {
      x:
        source.clientX -
        rect.left,

      y:
        source.clientY -
        rect.top,
    };
  };

  /* =======================================================
     SCRATCH
  ======================================================= */

  const scratchAt = (point) => {
    const canvas =
      canvasRef.current;

    if (!canvas || !point) return;

    const ctx =
      canvas.getContext("2d");

    ctx.save();

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.lineCap = "round";

    ctx.lineJoin = "round";

    ctx.lineWidth = 42;

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
        21,
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
     CALCULATE REVEAL %
  ======================================================= */

  const calculateScratchProgress =
    () => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      const imageData =
        ctx.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        );

      let transparent = 0;

      const data =
        imageData.data;

      /*
        Sample pixels instead of
        checking every pixel.
      */

      const step = 16;

      for (
        let i = 3;
        i < data.length;
        i +=
          4 * step
      ) {
        if (data[i] < 80) {
          transparent++;
        }
      }

      const total =
        Math.ceil(
          data.length /
            (4 * step)
        );

      const percentage =
        Math.min(
          100,
          Math.round(
            (transparent /
              total) *
              100
          )
        );

      setProgress(
        percentage
      );

      if (percentage >= 58) {
        revealReward();
      }
    };

  /* =======================================================
     REVEAL
  ======================================================= */

  const revealReward = () => {
    if (revealed) return;

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
  };

  /* =======================================================
     POINTER EVENTS
  ======================================================= */

  const handlePointerDown =
    (event) => {
      if (revealed) return;

      event.preventDefault();

      isDrawingRef.current =
        true;

      lastPointRef.current =
        null;

      const point =
        getPoint(event);

      scratchAt(point);
    };

  const handlePointerMove =
    (event) => {
      if (
        !isDrawingRef.current ||
        revealed
      ) {
        return;
      }

      event.preventDefault();

      const point =
        getPoint(event);

      scratchAt(point);
    };

  const stopScratch = () => {
    isDrawingRef.current =
      false;

    lastPointRef.current =
      null;
  };

  /* =======================================================
     NO CUSTOMER
  ======================================================= */

  if (!customerId) {
    return null;
  }

  /* =======================================================
     ACTIVE REWARD
  ======================================================= */

  if (hasReward) {
    return (
      <div
        className={`sugar-reward-card premium-reward-card ${
          revealed
            ? "is-revealed"
            : ""
        }`}
      >

        {/* ================================================
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

        {/* ================================================
            INTRO
        ================================================= */}

        {!revealed && (
          <div className="scratch-intro">

            <div className="scratch-sparkle">
              ✨
            </div>

            <h2>
              Your Reward Is Here!
            </h2>

            <p>
              Use your finger to scratch
              the card and reveal your
              exclusive SugarCafe reward.
            </p>

          </div>
        )}

        {/* ================================================
            SCRATCH AREA
        ================================================= */}

        <div
          ref={scratchAreaRef}
          className={`scratch-area ${
            revealed
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
        >

          {/* ============================================
              ACTUAL REWARD BEHIND SCRATCH
          ============================================= */}

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
                  {reward?.discountPercent ||
                    5}
                  % discount reward
                </small>
              ) : (
                <small>
                  Enjoy a complimentary{" "}
                  {rewardItemName}
                </small>
              )}

            </div>

          </div>

          {/* ============================================
              CANVAS
          ============================================= */}

          {!revealed && (
            <canvas
              ref={canvasRef}
              className="scratch-canvas"
            />
          )}

          {/* ============================================
              CENTER INSTRUCTION
          ============================================= */}

          {!revealed && (
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
                {progress}% revealed
              </div>

            </div>
          )}

          {/* ============================================
              REVEALED
          ============================================= */}

          {revealed && (
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
                  {reward?.discountPercent ||
                    5}
                  % OFF
                </small>
              ) : (
                <small>
                  Your complimentary{" "}
                  {rewardItemName} is waiting
                </small>
              )}

            </div>
          )}

        </div>

        {/* ================================================
            HELP
        ================================================= */}

        {!revealed && (
          <div className="scratch-help">

            <span>
              ☝️
            </span>

            <div>
              <strong>
                Scratch with your finger
              </strong>

              <small>
                Reveal more than 58% to
                unlock your reward
              </small>
            </div>

          </div>
        )}

        {/* ================================================
            REDEEM INFO
        ================================================= */}

        {revealed && (
          <div className="reward-redeem-box">

            <div className="redeem-icon">
              🎁
            </div>

            <div className="redeem-text">

              <strong>
                Show this reward to
                SugarCafe staff
              </strong>

              <span>
                Reward: {rewardTitle}
              </span>

              {rewardOrder?.orderNumber && (
                <small>
                  Reward Order: #
                  {rewardOrder.orderNumber}
                </small>
              )}

            </div>

            <div className="redeem-status">
              {reward?.status ===
              "redeemed"
                ? "USED"
                : "READY"}
            </div>

          </div>
        )}

        {/* ================================================
            FOOTER
        ================================================= */}

        <div className="reward-card-footer">

          <span>
            🎁 6 + 1 Rewards
          </span>

          <span>
            {reward?.status ===
            "carried"
              ? "Reward carried to next order"
              : "Show at counter"}
          </span>

        </div>

      </div>
    );
  }

  /* =======================================================
     NO ACTIVE REWARD
  ======================================================= */

  if (qualifyingCount < 6) {
    const remaining =
      6 - qualifyingCount;

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
            {qualifyingCount}/6
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
                  (qualifyingCount /
                    6) *
                  100
                }%`,
              }}
            />

          </div>

          <div className="reward-progress-text">

            <span>
              {qualifyingCount}/6
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
     6 COMPLETED — WAITING FOR 7TH ORDER
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
              Your Scratch Card reward
              will appear automatically
              after the order is placed.
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
