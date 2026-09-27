import React, { useEffect, useRef, useState } from "react";
import "./ScratchCard.css";

const DEFAULT_REWARD = {
  type: "discount",
  discountPercent: 5,
  title: "5% OFF",
  message: "You won 5% OFF on your order!"
};

function ScratchCard({
  reward = DEFAULT_REWARD,
  onComplete,
  onReward,
  disabled = false,
  className = ""
}) {
  const canvasRef = useRef(null);
  const scratchingRef = useRef(false);
  const completedRef = useRef(false);

  const [completed, setCompleted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const rewardData = {
    ...DEFAULT_REWARD,
    ...(reward || {})
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const dpr =
      window.devicePixelRatio || 1;

    const width = 320;
    const height = 190;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    ctx.globalCompositeOperation =
      "source-over";

    /* Scratch surface */
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#111827"
    );

    gradient.addColorStop(
      0.5,
      "#374151"
    );

    gradient.addColorStop(
      1,
      "#111827"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    /* Decorative pattern */
    ctx.fillStyle =
      "rgba(255,255,255,0.08)";

    for (
      let x = -height;
      x < width + height;
      x += 28
    ) {
      ctx.save();

      ctx.translate(
        x,
        0
      );

      ctx.rotate(
        Math.PI / 4
      );

      ctx.fillRect(
        0,
        0,
        10,
        height * 2
      );

      ctx.restore();
    }

    /* Text */
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      "800 24px Arial";

    ctx.fillText(
      "SCRATCH & WIN",
      width / 2,
      70
    );

    ctx.font =
      "600 15px Arial";

    ctx.fillStyle =
      "rgba(255,255,255,0.85)";

    ctx.fillText(
      "Scratch here to reveal your reward",
      width / 2,
      112
    );

    ctx.font =
      "700 14px Arial";

    ctx.fillStyle =
      "#fbbf24";

    ctx.fillText(
      "🎁 DAILY REWARD",
      width / 2,
      145
    );

    /* Scratch layer */
    ctx.globalCompositeOperation =
      "source-over";
  }, []);

  const getPosition = (event) => {
    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    let clientX;
    let clientY;

    if (
      event.touches &&
      event.touches.length
    ) {
      clientX =
        event.touches[0].clientX;

      clientY =
        event.touches[0].clientY;
    } else {
      clientX =
        event.clientX;

      clientY =
        event.clientY;
    }

    return {
      x:
        clientX -
        rect.left,

      y:
        clientY -
        rect.top
    };
  };

  const scratch = (event) => {
    if (
      disabled ||
      completedRef.current
    ) {
      return;
    }

    const canvas =
      canvasRef.current;

    const ctx =
      canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return;
    }

    const { x, y } =
      getPosition(event);

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      22,
      0,
      Math.PI * 2
    );

    ctx.fill();

    checkProgress();
  };

  const startScratch = (event) => {
    if (disabled) return;

    scratchingRef.current = true;

    event.preventDefault();

    scratch(event);
  };

  const moveScratch = (event) => {
    if (
      !scratchingRef.current
    ) {
      return;
    }

    event.preventDefault();

    scratch(event);
  };

  const stopScratch = () => {
    scratchingRef.current =
      false;
  };

  const checkProgress = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    const width =
      canvas.width;

    const height =
      canvas.height;

    /*
     * Check only a reduced sample
     * for better mobile performance.
     */
    const imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      );

    const data =
      imageData.data;

    let transparent = 0;

    const step = 16;

    let total = 0;

    for (
      let y = 0;
      y < height;
      y += step
    ) {
      for (
        let x = 0;
        x < width;
        x += step
      ) {
        const index =
          (y * width + x) * 4;

        total++;

        if (
          data[index + 3] <
          100
        ) {
          transparent++;
        }
      }
    }

    const percent =
      (transparent / total) *
      100;

    if (
      percent >= 45 &&
      !completedRef.current
    ) {
      revealReward();
    }
  };

  const revealReward = () => {
    if (
      completedRef.current
    ) {
      return;
    }

    completedRef.current =
      true;

    setCompleted(true);
    setRevealed(true);

    const rewardResult = {
      ...rewardData,
      won: true,
      revealedAt:
        new Date().toISOString()
    };

    if (
      typeof onReward ===
      "function"
    ) {
      onReward(
        rewardResult
      );
    }

    if (
      typeof onComplete ===
      "function"
    ) {
      onComplete(
        rewardResult
      );
    }
  };

  const rewardText =
    rewardData.type ===
      "free_menu_item" ||
    rewardData.type ===
      "free_item"
      ? `FREE ${
          rewardData.itemName ||
          rewardData.title ||
          "ITEM"
        }`
      : rewardData.discountPercent
      ? `${rewardData.discountPercent}% OFF`
      : rewardData.title ||
        "YOU WON!";

  return (
    <div
      className={`scratch-card-wrapper ${className}`}
    >
      <div
        className={`scratch-card ${
          completed
            ? "scratch-completed"
            : ""
        }`}
      >
        <div className="scratch-reward">
          <div className="scratch-gift">
            🎁
          </div>

          <div className="scratch-win-title">
            CONGRATULATIONS!
          </div>

          <div className="scratch-reward-value">
            {rewardText}
          </div>

          <div className="scratch-reward-message">
            {rewardData.message ||
              "Your daily reward is unlocked!"}
          </div>
        </div>

        {!revealed && (
          <canvas
            ref={canvasRef}
            className="scratch-canvas"
            onMouseDown={
              startScratch
            }
            onMouseMove={
              moveScratch
            }
            onMouseUp={
              stopScratch
            }
            onMouseLeave={
              stopScratch
            }
            onTouchStart={
              startScratch
            }
            onTouchMove={
              moveScratch
            }
            onTouchEnd={
              stopScratch
            }
          />
        )}

        {revealed && (
          <div className="scratch-success">
            <span>
              🎉
            </span>

            <strong>
              {rewardText}
            </strong>

            <small>
              Reward unlocked
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScratchCard;
