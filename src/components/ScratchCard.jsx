import { useEffect, useState } from "react";
import "./ScratchCard.css";

const prizes = [
  "₹20 OFF",
  "FREE DRINK",
  "₹30 OFF",
  "10% OFF",
  "FREE FRIES",
];

function getTodayKey() {
  const date = new Date();

  return `sugarCafeScratch-${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ScratchCard() {
  const [scratched, setScratched] = useState(false);
  const [prize, setPrize] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const todayKey = getTodayKey();
    const saved = localStorage.getItem(todayKey);

    if (saved) {
      try {
        const data = JSON.parse(saved);

        setScratched(true);
        setPrize(data.prize);
      } catch {
        localStorage.removeItem(todayKey);
      }
    }
  }, []);

  const handleScratch = () => {
    if (scratched) return;

    const randomPrize =
      prizes[Math.floor(Math.random() * prizes.length)];

    const todayKey = getTodayKey();

    localStorage.setItem(
      todayKey,
      JSON.stringify({
        prize: randomPrize,
        scratchedAt: Date.now(),
      })
    );

    setPrize(randomPrize);
    setScratched(true);
    setVisible(true);
  };

  return (
    <section className="scratch-section">

      <div className="scratch-card">

        <div className="scratch-glow" />

        <div className="scratch-header">
          <span className="scratch-star">✦</span>

          <div>
            <h2>Daily Scratch & Win</h2>
            <p>Today's special surprise is waiting for you</p>
          </div>
        </div>

        <div className="scratch-box">

          {!scratched ? (
            <button
              type="button"
              className="scratch-button"
              onClick={handleScratch}
            >
              <span className="scratch-shine" />

              <span className="scratch-icon">
                🎁
              </span>

              <strong>SCRATCH TO REVEAL</strong>

              <small>
                Your daily reward
              </small>
            </button>
          ) : (
            <div
              className={`scratch-result ${
                visible ? "scratch-result-show" : ""
              }`}
            >
              <div className="reward-confetti">
                ✦ ✧ ✦ ✧ ✦
              </div>

              <span className="reward-icon">
                🎉
              </span>

              <p>Congratulations!</p>

              <h3>{prize}</h3>

              <small>
                Show this offer while ordering today
              </small>
            </div>
          )}

        </div>

        <div className="scratch-footer">
          <span>🎁 1 reward per customer</span>
          <span>•</span>
          <span>Valid today</span>
        </div>

      </div>

    </section>
  );
}

export default ScratchCard;
