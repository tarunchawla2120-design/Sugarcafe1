import { useEffect, useMemo, useState } from "react";
import "./SugarCafeRewardCard.css";

/* =========================================================
   REWARDS
   ========================================================= */

const REWARDS = [
  {
    id: "free-fries",
    title: "FREE FRENCH FRIES",
    subtitle: "Get one regular French Fries FREE",
    icon: "🍟",
    type: "free-item",
  },
  {
    id: "free-beverage",
    title: "FREE BEVERAGE",
    subtitle: "Get one selected beverage FREE",
    icon: "🥤",
    type: "free-item",
  },
  {
    id: "free-dessert",
    title: "FREE DESSERT",
    subtitle: "Get one selected dessert FREE",
    icon: "🍰",
    type: "free-item",
  },
  {
    id: "free-cheese-puff",
    title: "FREE CHEESE PUFF",
    subtitle: "Get one selected cheese puff FREE",
    icon: "🧀",
    type: "free-item",
  },
  {
    id: "free-shake",
    title: "FREE SHAKE",
    subtitle: "Get one selected shake FREE",
    icon: "🥤",
    type: "free-item",
  },
  {
    id: "discount-5",
    title: "5% OFF",
    subtitle: "Get 5% OFF on your eligible order",
    icon: "🎟️",
    type: "discount",
    value: 5,
  },
  {
    id: "discount-10",
    title: "10% OFF",
    subtitle: "Get 10% OFF on your eligible order",
    icon: "🎉",
    type: "discount",
    value: 10,
  },
];

/* =========================================================
   DETERMINISTIC REWARD
   Same customer + same cycle = same reward
========================================================= */

function getRewardForCycle(customerId, cycleNumber) {
  const source =
    `${customerId || "guest"}-${cycleNumber}`;

  let hash = 0;

  for (let i = 0; i < source.length; i++) {
    hash =
      (hash * 31 +
        source.charCodeAt(i)) &
      0xffffffff;
  }

  const index =
    Math.abs(hash) % REWARDS.length;

  return REWARDS[index];
}

/* =========================================================
   STORAGE KEY
========================================================= */

function getStorageKey(customerId, cycleNumber) {
  return `sugarCafeScratch-${customerId}-${cycleNumber}`;
}

/* =========================================================
   COMPONENT
========================================================= */

function SugarCafeRewardCard({
  orders = [],
  customerId = "",
}) {
  const [scratched, setScratched] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [scratchProgress, setScratchProgress] = useState(0);

  /* =======================================================
     QUALIFYING ORDERS

     ONLY:
     Delivered / Completed
     AND total >= ₹500
  ======================================================= */

  const qualifyingOrders = useMemo(() => {
    return orders.filter((order) => {
      const status =
        String(order.status || "")
          .toLowerCase()
          .trim();

      const completed =
        status === "delivered" ||
        status === "completed";

      const amount = Number(
        order.total ??
          order.grandTotal ??
          order.finalTotal ??
          0
      );

      return (
        completed &&
        amount >= 500
      );
    });
  }, [orders]);

  const qualifyingCount =
    qualifyingOrders.length;

  /* =======================================================
     CURRENT CYCLE

     0-5  => progress
     6    => reward unlocked
     7+   => next cycle starts
  ======================================================= */

  const cycleNumber =
    Math.floor(
      qualifyingCount / 6
    );

  const progress =
    qualifyingCount % 6;

  const rewardReady =
    progress === 0 &&
    qualifyingCount > 0;

  const nextRewardNumber =
    Math.floor(
      qualifyingCount / 6
    );

  /* =======================================================
     7TH ORDER LOGIC

     Once 6 qualifying orders are completed,
     next order is the reward order.
  ======================================================= */

  const hasSixCompleted =
    qualifyingCount >= 6;

  const rewardCycle =
    hasSixCompleted
      ? Math.floor(
          qualifyingCount / 6
        )
      : 0;

  const reward =
    customerId
      ? getRewardForCycle(
          customerId,
          rewardCycle
        )
      : null;

  /* =======================================================
     LOAD SAVED SCRATCH STATE

     Reward itself is deterministic.
     Only UI state is saved locally.
  ======================================================= */

  useEffect(() => {
    if (!customerId || !rewardReady) {
      setScratched(false);
      setClaimed(false);
      setScratchProgress(0);
      return;
    }

    const key =
      getStorageKey(
        customerId,
        nextRewardNumber
      );

    try {
      const saved =
        JSON.parse(
          localStorage.getItem(key) ||
            "null"
        );

      if (saved) {
        setScratched(
          Boolean(saved.scratched)
        );

        setClaimed(
          Boolean(saved.claimed)
        );

        setScratchProgress(
          Number(
            saved.progress || 0
          )
        );
      } else {
        setScratched(false);
        setClaimed(false);
        setScratchProgress(0);
      }
    } catch {
      setScratched(false);
      setClaimed(false);
      setScratchProgress(0);
    }
  }, [
    customerId,
    rewardReady,
    nextRewardNumber,
  ]);

  /* =======================================================
     SAVE STATE
  ======================================================= */

  const saveState = (
    nextScratched,
    nextClaimed,
    nextProgress
  ) => {
    if (!customerId) return;

    const key =
      getStorageKey(
        customerId,
        nextRewardNumber
      );

    localStorage.setItem(
      key,
      JSON.stringify({
        scratched: nextScratched,
        claimed: nextClaimed,
        progress: nextProgress,
      })
    );
  };

  /* =======================================================
     SCRATCH

     Simple tap-based digital scratch.
     No paid service / no external API.
  ======================================================= */

  const handleScratch = () => {
    if (claimed) return;

    const newProgress =
      Math.min(
        100,
        scratchProgress + 35
      );

    if (newProgress >= 100) {
      setScratchProgress(100);
      setScratched(true);

      saveState(
        true,
        false,
        100
      );
    } else {
      setScratchProgress(
        newProgress
      );

      saveState(
        false,
        false,
        newProgress
      );
    }
  };

  /* =======================================================
     CLAIM

     For now this marks the reward as claimed
     on the customer's device.

     Actual discount/free item should be
     validated by counter staff before use.
  ======================================================= */

  const handleClaim = () => {
    setClaimed(true);

    saveState(
      true,
      true,
      100
    );
  };

  /* =======================================================
     NO CUSTOMER
  ======================================================= */

  if (!customerId) {
    return null;
  }

  /* =======================================================
     NO QUALIFYING ORDERS
  ======================================================= */

  if (qualifyingCount === 0) {
    return (
      <section className="sc-reward-card">
        <div className="sc-reward-top">
          <div>
            <span>
              SUGAR CAFÉ REWARDS
            </span>

            <h3>
              Your Scratch Card Journey
            </h3>
          </div>

          <div className="sc-reward-icon">
            🎁
          </div>
        </div>

        <p className="sc-reward-description">
          Complete 6 delivered orders
          of ₹500 or more and unlock
          a surprise Scratch Card for
          your next order.
        </p>

        <div className="sc-progress-dots">
          {Array.from(
            { length: 6 },
            (_, index) => (
              <span
                key={index}
                className=""
              />
            )
          )}
        </div>

        <div className="sc-progress-text">
          <strong>
            0 / 6
          </strong>

          <span>
            qualifying orders
          </span>
        </div>

        <div className="sc-rule">
          ₹500+ bill required for each
          qualifying order
        </div>
      </section>
    );
  }

  /* =======================================================
     1-5 PROGRESS
  ======================================================= */

  if (
    qualifyingCount < 6
  ) {
    return (
      <section className="sc-reward-card">
        <div className="sc-reward-top">
          <div>
            <span>
              SUGAR CAFÉ REWARDS
            </span>

            <h3>
              Scratch Card Progress
            </h3>
          </div>

          <div className="sc-reward-icon">
            🎁
          </div>
        </div>

        <p className="sc-reward-description">
          Complete 6 delivered orders
          of ₹500+ to unlock your
          mystery reward.
        </p>

        <div className="sc-progress-dots">
          {Array.from(
            { length: 6 },
            (_, index) => (
              <span
                key={index}
                className={
                  index <
                  qualifyingCount
                    ? "filled"
                    : ""
                }
              >
                {index <
                qualifyingCount
                  ? "✓"
                  : ""}
              </span>
            )
          )}
        </div>

        <div className="sc-progress-text">
          <strong>
            {qualifyingCount} / 6
          </strong>

          <span>
            qualifying orders
          </span>
        </div>

        <div className="sc-reward-next">
          <strong>
            {6 -
              qualifyingCount}{" "}
            more qualifying{" "}
            {6 -
              qualifyingCount ===
            1
              ? "order"
              : "orders"}
          </strong>

          <span>
            Minimum ₹500 per bill
          </span>
        </div>
      </section>
    );
  }

  /* =======================================================
     REWARD READY / SCRATCH CARD
  ======================================================= */

  return (
    <section className="sc-reward-card sc-reward-unlocked">

      <div className="sc-reward-top">
        <div>
          <span>
            SUGAR CAFÉ REWARDS
          </span>

          <h3>
            🎉 Scratch Card Unlocked!
          </h3>
        </div>

        <div className="sc-reward-icon">
          🎟️
        </div>
      </div>

      {!scratched ? (
        <>
          <div className="sc-scratch-card">

            <div className="sc-scratch-inner">

              <div className="sc-scratch-lock">
                🔒
              </div>

              <small>
                MYSTERY REWARD
              </small>

              <strong>
                SCRATCH TO REVEAL
              </strong>

              <div className="sc-scratch-cover">
                <span>
                  ✨ SCRATCH HERE ✨
                </span>

                <button
                  type="button"
                  onClick={
                    handleScratch
                  }
                >
                  Scratch
                </button>
              </div>

              <div className="sc-scratch-progress">
                <div
                  style={{
                    width: `${scratchProgress}%`,
                  }}
                />
              </div>

              <small>
                Keep tapping to reveal
                your reward
              </small>

            </div>
          </div>

          <div className="sc-reward-note">
            🎁 Your reward is linked to
            your Customer ID.
          </div>
        </>
      ) : (
        <div className="sc-reward-revealed">

          <div className="sc-confetti">
            🎉 🎊 🎉
          </div>

          <span>
            YOU WON
          </span>

          <div className="sc-won-icon">
            {reward?.icon}
          </div>

          <h2>
            {reward?.title}
          </h2>

          <p>
            {reward?.subtitle}
          </p>

          {!claimed ? (
            <>
              <div className="sc-counter-note">
                Show this reward screen
                at the Sugar Café counter
                before using it.
              </div>

              <button
                type="button"
                className="sc-claim-button"
                onClick={
                  handleClaim
                }
              >
                ✓ Mark Reward Used
              </button>
            </>
          ) : (
            <div className="sc-claimed">
              ✓ REWARD MARKED AS USED
            </div>
          )}

        </div>
      )}

      <div className="sc-reward-footer">
        <span>
          Cycle #{rewardCycle}
        </span>

        <span>
          6 × ₹500+ orders completed
        </span>
      </div>

    </section>
  );
}

export default SugarCafeRewardCard;
