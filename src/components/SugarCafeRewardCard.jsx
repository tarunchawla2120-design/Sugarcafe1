import { useEffect, useMemo, useState } from "react";
import "./SugarCafeRewardCard.css";

const MINIMUM_ORDER_AMOUNT = 500;

// ---------------------------------------------------------
// REWARDS
// ---------------------------------------------------------

const REWARDS = [
  {
    type: "free_item",
    title: "FREE FRENCH FRIES",
    subtitle: "Enjoy a complimentary French Fries",
    icon: "🍟",
  },
  {
    type: "free_item",
    title: "FREE BEVERAGE",
    subtitle: "Get one complimentary Beverage",
    icon: "🥤",
  },
  {
    type: "free_item",
    title: "FREE DESSERT",
    subtitle: "Enjoy a complimentary Dessert",
    icon: "🍰",
  },
  {
    type: "free_item",
    title: "FREE CHEESE PUFF",
    subtitle: "Get one complimentary Cheese Puff",
    icon: "🥐",
  },
  {
    type: "free_item",
    title: "FREE SHAKE",
    subtitle: "Enjoy a complimentary Shake",
    icon: "🥤",
  },
  {
    type: "discount",
    title: "5% OFF",
    subtitle: "Get 5% off on your next eligible bill",
    icon: "🎁",
  },
  {
    type: "discount",
    title: "10% OFF",
    subtitle: "Get 10% off on your next eligible bill",
    icon: "🎉",
  },
];

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getOrderTime(order) {
  if (order?.createdAt?.toMillis) {
    return order.createdAt.toMillis();
  }

  if (order?.createdAt?.toDate) {
    return order.createdAt.toDate().getTime();
  }

  if (order?.createdAt) {
    const time = new Date(order.createdAt).getTime();

    if (!Number.isNaN(time)) {
      return time;
    }
  }

  return 0;
}

function isCompletedOrder(order) {
  const status = String(order?.status || "")
    .toLowerCase()
    .trim();

  return (
    status === "delivered" ||
    status === "completed"
  );
}

function getQualifyingAmount(order) {
  // Food bill/subtotal is used for the ₹500 qualification.
  // Falls back to total for older orders where subtotal is missing.
  return Number(
    order?.subtotal ??
    order?.total ??
    order?.grandTotal ??
    order?.finalTotal ??
    0
  );
}

function isQualifyingOrder(order) {
  return (
    isCompletedOrder(order) &&
    getQualifyingAmount(order) >= MINIMUM_ORDER_AMOUNT
  );
}

// ---------------------------------------------------------
// DETERMINISTIC REWARD
// Same customer + same cycle = same reward.
// No backend / paid messaging / Blaze required.
// ---------------------------------------------------------

function getRewardForCycle(customerId, cycleNumber) {
  const text = `${customerId || "customer"}-${cycleNumber}`;

  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash =
      (hash << 5) -
      hash +
      text.charCodeAt(i);

    hash |= 0;
  }

  const index =
    Math.abs(hash) % REWARDS.length;

  return REWARDS[index];
}

// ---------------------------------------------------------
// STORAGE
// ---------------------------------------------------------

function getClaimKey(customerId, cycleNumber) {
  return `sugarCafeRewardClaimed:${customerId}:cycle:${cycleNumber}`;
}

function getScratchKey(customerId, cycleNumber) {
  return `sugarCafeRewardScratch:${customerId}:cycle:${cycleNumber}`;
}

function getClaimed(customerId, cycleNumber) {
  try {
    return (
      localStorage.getItem(
        getClaimKey(customerId, cycleNumber)
      ) === "true"
    );
  } catch {
    return false;
  }
}

function setClaimed(customerId, cycleNumber) {
  try {
    localStorage.setItem(
      getClaimKey(customerId, cycleNumber),
      "true"
    );
  } catch (error) {
    console.error(
      "Reward claim storage error:",
      error
    );
  }
}

function getScratchProgress(
  customerId,
  cycleNumber
) {
  try {
    const value = Number(
      localStorage.getItem(
        getScratchKey(
          customerId,
          cycleNumber
        )
      )
    );

    return Number.isFinite(value)
      ? Math.min(Math.max(value, 0), 100)
      : 0;
  } catch {
    return 0;
  }
}

function saveScratchProgress(
  customerId,
  cycleNumber,
  value
) {
  try {
    localStorage.setItem(
      getScratchKey(
        customerId,
        cycleNumber
      ),
      String(value)
    );
  } catch (error) {
    console.error(
      "Scratch progress storage error:",
      error
    );
  }
}

// =========================================================
// COMPONENT
// =========================================================

export default function SugarCafeRewardCard({
  orders = [],
  customerId = "",
}) {
  const [scratchProgress, setScratchProgress] =
    useState(0);

  const [revealed, setRevealed] =
    useState(false);

  const [claimed, setClaimedState] =
    useState(false);

  const [showReward, setShowReward] =
    useState(false);

  // -------------------------------------------------------
  // SORT ORDERS
  // -------------------------------------------------------

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) =>
        getOrderTime(a) -
        getOrderTime(b)
    );
  }, [orders]);

  // -------------------------------------------------------
  // QUALIFYING ORDERS
  // -------------------------------------------------------

  const qualifyingOrders = useMemo(() => {
    return sortedOrders.filter(
      isQualifyingOrder
    );
  }, [sortedOrders]);

  const qualifyingCount =
    qualifyingOrders.length;

  // -------------------------------------------------------
  // COMPLETED 6-ORDER CYCLES
  // -------------------------------------------------------

  const completedCycles = Math.floor(
    qualifyingCount / 6
  );

  // -------------------------------------------------------
  // FIND THE CURRENT REWARD CYCLE
  //
  // Example:
  //
  // 0-5 qualifying orders = no reward
  // 6 qualifying orders   = cycle 1 ready
  // 7-11                  = cycle 1 reward
  // 12 qualifying orders  = cycle 2 ready
  // -------------------------------------------------------

  const currentCycle =
    completedCycles;

  const rewardReady =
    currentCycle > 0;

  // -------------------------------------------------------
  // CHECK WHETHER THE NEXT/7TH ORDER EXISTS
  //
  // We don't reveal the scratch card immediately
  // after order #6.
  //
  // Once any order is placed after the 6th qualifying
  // order, that order becomes the 7th/reward order.
  // -------------------------------------------------------

  const rewardOrderExists = useMemo(() => {
    if (!rewardReady) {
      return false;
    }

    const sixthOrderIndex =
      currentCycle * 6 - 1;

    const sixthQualifyingOrder =
      qualifyingOrders[
        sixthOrderIndex
      ];

    if (!sixthQualifyingOrder) {
      return false;
    }

    const sixthOrderTime =
      getOrderTime(
        sixthQualifyingOrder
      );

    return sortedOrders.some((order) => {
      return (
        getOrderTime(order) >
        sixthOrderTime
      );
    });
  }, [
    rewardReady,
    currentCycle,
    qualifyingOrders,
    sortedOrders,
  ]);

  // -------------------------------------------------------
  // LOAD CURRENT REWARD STATE
  // -------------------------------------------------------

  useEffect(() => {
    if (!customerId || !currentCycle) {
      setScratchProgress(0);
      setRevealed(false);
      setClaimedState(false);
      return;
    }

    const isClaimed = getClaimed(
      customerId,
      currentCycle
    );

    const savedProgress =
      getScratchProgress(
        customerId,
        currentCycle
      );

    setClaimedState(isClaimed);
    setScratchProgress(savedProgress);

    if (savedProgress >= 100) {
      setRevealed(true);
    } else {
      setRevealed(false);
    }
  }, [
    customerId,
    currentCycle,
  ]);

  // -------------------------------------------------------
  // RESET / RELOAD WHEN NEW REWARD ORDER APPEARS
  // -------------------------------------------------------

  useEffect(() => {
    if (
      !rewardOrderExists ||
      !currentCycle ||
      !customerId
    ) {
      return;
    }

    const isClaimed = getClaimed(
      customerId,
      currentCycle
    );

    if (isClaimed) {
      setClaimedState(true);
      return;
    }

    const progress =
      getScratchProgress(
        customerId,
        currentCycle
      );

    setScratchProgress(progress);

    if (progress >= 100) {
      setRevealed(true);
    }
  }, [
    rewardOrderExists,
    currentCycle,
    customerId,
  ]);

  // -------------------------------------------------------
  // PROGRESS
  // -------------------------------------------------------

  const progressCount =
    qualifyingCount % 6;

  const displayProgress =
    progressCount === 0
      ? 6
      : progressCount;

  const progressPercent =
    (displayProgress / 6) * 100;

  // -------------------------------------------------------
  // REWARD
  // -------------------------------------------------------

  const reward = currentCycle
    ? getRewardForCycle(
        customerId,
        currentCycle
      )
    : null;

  // -------------------------------------------------------
  // SCRATCH
  // -------------------------------------------------------

  const scratch = () => {
    if (
      !rewardOrderExists ||
      claimed ||
      revealed
    ) {
      return;
    }

    const nextProgress =
      Math.min(
        scratchProgress + 25,
        100
      );

    setScratchProgress(
      nextProgress
    );

    saveScratchProgress(
      customerId,
      currentCycle,
      nextProgress
    );

    if (nextProgress >= 100) {
      setRevealed(true);
    }
  };

  // -------------------------------------------------------
  // CLAIM / USE REWARD
  // -------------------------------------------------------

  const handleClaimReward = () => {
    if (
      !revealed ||
      claimed ||
      !customerId ||
      !currentCycle
    ) {
      return;
    }

    setClaimed(
      customerId,
      currentCycle
    );

    setClaimedState(true);
    setShowReward(false);
  };

  // -------------------------------------------------------
  // NO CUSTOMER
  // -------------------------------------------------------

  if (!customerId) {
    return null;
  }

  // -------------------------------------------------------
  // LESS THAN 6 ORDERS
  // -------------------------------------------------------

  if (!rewardReady) {
    return (
      <div className="sugar-reward-card">
        <div className="reward-card-top">

          <div className="reward-brand">
            <span className="reward-brand-icon">
              🎁
            </span>

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
            You're {6 - qualifyingCount}{" "}
            order
            {6 - qualifyingCount !== 1
              ? "s"
              : ""}{" "}
            away!
          </h2>

          <p>
            Complete 6 delivered orders
            of ₹{MINIMUM_ORDER_AMOUNT}+
            to unlock your 7th-order
            Scratch Card.
          </p>

          <div className="reward-progress-track">
            <div
              className="reward-progress-fill"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>

          <div className="reward-progress-text">
            <span>
              {displayProgress}/6
            </span>

            <span>
              ₹500+ per qualifying bill
            </span>
          </div>

        </div>

        <div className="reward-card-footer">
          <span>
            🎉 Complete 6 orders
          </span>

          <span>
            🎁 7th order = Scratch Card
          </span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // 6 ORDERS COMPLETE BUT 7TH ORDER NOT PLACED
  // -------------------------------------------------------

  if (
    rewardReady &&
    !rewardOrderExists &&
    !claimed
  ) {
    return (
      <div className="sugar-reward-card reward-ready-card">

        <div className="reward-card-top">

          <div className="reward-brand">
            <span className="reward-brand-icon">
              🎁
            </span>

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
            Your Scratch Card is Ready!
          </h2>

          <p>
            You completed 6 qualifying
            orders.
          </p>

          <div className="reward-next-order">
            <span>
              7
            </span>

            <div>
              <strong>
                Your next order unlocks
                the Scratch Card
              </strong>

              <small>
                Place your 7th order and
                come back here to scratch.
              </small>
            </div>
          </div>

        </div>

        <button
          className="reward-order-button"
          onClick={() => {
            window.location.href =
              "/menu";
          }}
        >
          ORDER NOW →
        </button>

      </div>
    );
  }

  // -------------------------------------------------------
  // CLAIMED
  // -------------------------------------------------------

  if (claimed) {
    return (
      <div className="sugar-reward-card reward-claimed-card">

        <div className="reward-card-top">

          <div className="reward-brand">
            <span className="reward-brand-icon">
              ⭐
            </span>

            <div>
              <strong>
                SugarCafe Rewards
              </strong>

              <small>
                Reward Redeemed
              </small>
            </div>
          </div>

          <div className="reward-used-badge">
            USED
          </div>

        </div>

        <div className="reward-main">

          <div className="reward-success-icon">
            ✓
          </div>

          <h2>
            Reward Redeemed
          </h2>

          <p>
            Your Scratch Card reward has
            been marked as used.
          </p>

          <div className="reward-next-cycle">
            <strong>
              Keep ordering!
            </strong>

            <span>
              Complete 6 more ₹500+
              qualifying orders for
              your next reward.
            </span>
          </div>

        </div>

      </div>
    );
  }

  // -------------------------------------------------------
  // SCRATCH CARD
  // -------------------------------------------------------

  return (
    <div className="sugar-reward-card scratch-card-wrapper">

      <div className="reward-card-top">

        <div className="reward-brand">
          <span className="reward-brand-icon">
            🎁
          </span>

          <div>
            <strong>
              SugarCafe Rewards
            </strong>

            <small>
              Your 7th Order Reward
            </small>
          </div>
        </div>

        <div className="reward-live-badge">
          LIVE
        </div>

      </div>

      <div className="scratch-intro">

        <span className="scratch-star">
          ✨
        </span>

        <h2>
          Scratch to Reveal!
        </h2>

        <p>
          You completed your qualifying
          orders. Your reward is waiting.
        </p>

      </div>

      {/* ================================================
          SCRATCH AREA
      ================================================= */}

      <button
        type="button"
        className={`scratch-area ${
          revealed
            ? "scratch-revealed"
            : ""
        }`}
        onClick={scratch}
        disabled={revealed}
        aria-label="Scratch card"
      >

        {!revealed ? (
          <>

            <div
              className="scratch-overlay"
              style={{
                opacity:
                  Math.max(
                    0.15,
                    1 -
                      scratchProgress /
                        100
                  ),
              }}
            >

              <div className="scratch-pattern">
                ✦ ✧ ✦ ✧ ✦
                <br />
                ✧ ✦ ✧ ✦ ✧
                <br />
                ✦ ✧ ✦ ✧ ✦
              </div>

              <strong>
                TAP TO SCRATCH
              </strong>

              <small>
                {scratchProgress}%
                revealed
              </small>

            </div>

            <div className="hidden-reward">
              <span>
                {reward?.icon}
              </span>

              <strong>
                {reward?.title}
              </strong>
            </div>

          </>
        ) : (
          <div className="revealed-reward">

            <div className="revealed-confetti">
              🎉
            </div>

            <div className="revealed-icon">
              {reward?.icon}
            </div>

            <span>
              CONGRATULATIONS!
            </span>

            <strong>
              {reward?.title}
            </strong>

            <small>
              {reward?.subtitle}
            </small>

          </div>
        )}

      </button>

      {/* ================================================
          REWARD INSTRUCTION
      ================================================= */}

      {!revealed && (
        <div className="scratch-help">
          Tap the card 4 times to
          reveal your reward.
        </div>
      )}

      {revealed && (
        <div className="reward-redeem-box">

          <div>
            <strong>
              Show this screen at
              SugarCafe counter
            </strong>

            <span>
              Tell the staff that you have
              a Scratch Card reward.
            </span>
          </div>

          <button
            type="button"
            className="claim-reward-button"
            onClick={handleClaimReward}
          >
            MARK AS USED
          </button>

        </div>
      )}

      <div className="reward-card-footer">

        <span>
          🎁 6 + 1 Rewards
        </span>

        <span>
          Customer ID: {customerId}
        </span>

      </div>

    </div>
  );
}
