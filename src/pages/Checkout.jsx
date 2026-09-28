/* =========================================================
   SUGAR CAFE — CHECKOUT PREMIUM FINAL
========================================================= */

.checkout-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 16px 130px;
  box-sizing: border-box;
  color: #fff;
}

/* =========================================================
   COMMON CARD
========================================================= */

.checkout-card {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 18px;
  padding: 26px;
  border-radius: 30px;
  border: 1px solid rgba(120, 160, 200, 0.16);
  background: linear-gradient(
    145deg,
    rgba(14, 35, 55, 0.98),
    rgba(7, 25, 42, 0.98)
  );
  box-shadow:
    0 14px 35px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.025);
  overflow: hidden;
}

/* =========================================================
   SECTION HEADING
========================================================= */

.section-heading {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 24px;
}

.section-heading > div:last-child {
  min-width: 0;
  flex: 1;
}

.section-icon {
  width: 62px;
  height: 62px;
  min-width: 62px;
  border-radius: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 29px;

  background: linear-gradient(
    145deg,
    #163d61,
    #102e4b
  );

  border: 1px solid rgba(80, 150, 220, 0.15);

  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.04);
}

.section-kicker {
  display: block;
  margin-bottom: 5px;

  color: #ff765e;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 2px;
  line-height: 1.2;
}

.section-heading h2 {
  margin: 0;

  color: #fff;
  font-size: 27px;
  line-height: 1.15;
  font-weight: 800;
}

.section-heading p {
  margin: 7px 0 0;

  color: rgba(255,255,255,.55);
  font-size: 15px;
  line-height: 1.4;
}

/* =========================================================
   ORDER TYPE
========================================================= */

.order-type-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.order-type-option {
  min-height: 105px;
  padding: 16px;

  display: flex;
  align-items: center;
  gap: 14px;

  border-radius: 22px;
  border: 1px solid rgba(120,160,200,.18);

  background: linear-gradient(
    145deg,
    #102b45,
    #0d263e
  );

  color: #fff;
  text-align: left;

  cursor: pointer;

  transition:
    transform .18s ease,
    border-color .18s ease,
    background .18s ease;
}

.order-type-option:active {
  transform: scale(.985);
}

.order-type-option.active {
  border: 2px solid #ff7058;

  background: linear-gradient(
    145deg,
    rgba(40,39,53,.98),
    rgba(24,32,48,.98)
  );
}

.order-type-icon {
  width: 55px;
  height: 55px;
  min-width: 55px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 18px;

  background: linear-gradient(
    145deg,
    #12395c,
    #15324f
  );

  font-size: 27px;
}

.order-type-content {
  min-width: 0;
  flex: 1;
}

.order-type-content strong {
  display: block;
  color: #fff;
  font-size: 18px;
  line-height: 1.2;
}

.order-type-content small {
  display: block;
  margin-top: 6px;
  color: rgba(255,255,255,.58);
  font-size: 13px;
  line-height: 1.35;
}

.order-type-radio {
  width: 39px;
  height: 39px;
  min-width: 39px;

  border-radius: 50%;
  border: 3px solid #62778b;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 20px;
  font-weight: 800;
}

.order-type-option.active .order-type-radio {
  border-color: #ff7058;
  background: #ff7058;
  color: #fff;
}

/* =========================================================
   PAYMENT
========================================================= */

.payment-options {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.payment-option {
  width: 100%;
  min-height: 100px;

  padding: 16px 20px;
  box-sizing: border-box;

  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 16px;

  border-radius: 27px;
  border: 1px solid rgba(120,160,200,.18);

  background: linear-gradient(
    145deg,
    #102b45,
    #0d263e
  );

  color: #fff;
  text-align: left;

  cursor: pointer;

  transition:
    transform .18s ease,
    border-color .18s ease,
    background .18s ease,
    box-shadow .18s ease;
}

.payment-option:active {
  transform: scale(.985);
}

.payment-option.active {
  border: 2px solid #ff7058;

  background: linear-gradient(
    145deg,
    rgba(40,39,53,.98),
    rgba(24,32,48,.98)
  );

  box-shadow:
    0 0 0 1px rgba(255,112,88,.08),
    0 12px 28px rgba(0,0,0,.18);
}

.payment-option-icon {
  width: 64px;
  height: 64px;

  border-radius: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 29px;

  background: linear-gradient(
    145deg,
    #12395c,
    #15324f
  );
}

.payment-option > span:nth-child(2) {
  min-width: 0;

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.payment-option strong {
  display: block;

  color: #fff;
  font-size: 19px;
  line-height: 1.2;
}

.payment-option small {
  display: block;

  color: rgba(255,255,255,.58);
  font-size: 14px;
  line-height: 1.35;
}

.radio-modern {
  width: 42px;
  height: 42px;

  border-radius: 50%;
  border: 3px solid #62778b;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #fff;
  font-size: 21px;
  font-weight: 800;

  box-sizing: border-box;
}

.payment-option.active .radio-modern {
  border-color: #ff7058;
  background: #ff7058;
  color: #fff;
}

/* =========================================================
   LOCATION
========================================================= */

.location-card {
  position: relative;
}

.location-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.location-button {
  width: 100%;
  min-height: 50px;

  padding: 12px 16px;

  border-radius: 15px;
  border: 1px solid rgba(100,160,210,.25);

  background: #123654;
  color: #fff;

  font-size: 15px;
  font-weight: 700;

  cursor: pointer;
}

.location-button:active {
  transform: scale(.985);
}

.address-preview {
  width: 100%;
  box-sizing: border-box;

  display: flex;
  align-items: flex-start;
  gap: 14px;

  margin-top: 18px;
  padding: 16px;

  border-radius: 18px;

  background: rgba(15,48,75,.65);

  overflow: hidden;
}

.address-preview-content {
  min-width: 0;
  flex: 1;

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.address-preview-content > span {
  color: rgba(255,255,255,.55);
  font-size: 13px;
}

.address-preview-content > strong {
  color: #fff;
  font-size: 15px;
  line-height: 1.45;

  word-break: break-word;
  overflow-wrap: anywhere;
}

.distance-status {
  margin-top: 14px;

  color: rgba(255,255,255,.78);
  font-size: 14px;
  line-height: 1.5;
}

.distance-status strong {
  color: #fff;
}

/* =========================================================
   CUSTOMER
========================================================= */

.customer-profile-box {
  display: flex;
  align-items: center;
  gap: 16px;
}

.customer-profile-box > div:last-child {
  min-width: 0;
  flex: 1;

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.customer-profile-box strong {
  display: block;

  color: #fff;
  font-size: 20px;
  line-height: 1.2;

  overflow-wrap: anywhere;
}

.customer-profile-box span {
  display: block;

  color: rgba(255,255,255,.62);
  font-size: 15px;

  word-break: break-word;
}

.customer-avatar {
  width: 62px;
  height: 62px;
  min-width: 62px;

  border-radius: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    145deg,
    #173e62,
    #12304c
  );

  font-size: 30px;
}

/* =========================================================
   SPECIAL INSTRUCTIONS
========================================================= */

.special-instructions textarea,
.checkout-card textarea {
  width: 100%;
  min-height: 110px;

  box-sizing: border-box;

  padding: 14px 16px;

  border-radius: 16px;
  border: 1px solid rgba(120,160,200,.22);

  background: #f5f5f5;
  color: #111;

  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;

  resize: vertical;
  outline: none;
}

.special-instructions textarea:focus,
.checkout-card textarea:focus {
  border-color: #ff765e;
  box-shadow: 0 0 0 3px rgba(255,118,94,.12);
}

.special-instructions textarea::placeholder,
.checkout-card textarea::placeholder {
  color: #777;
}

.character-count {
  margin-top: 7px;

  color: rgba(255,255,255,.55);
  font-size: 13px;
  text-align: left;
}

/* =========================================================
   DAILY SCRATCH
========================================================= */

.scratch-card-section {
  padding-bottom: 24px;
}

.unlock-scratch-btn {
  width: 100%;
  min-height: 58px;

  border: 0;
  border-radius: 18px;

  background: linear-gradient(
    135deg,
    #ff765c,
    #ff9b55
  );

  color: #fff;

  font-size: 16px;
  font-weight: 800;

  cursor: pointer;

  box-shadow:
    0 10px 24px rgba(255,110,80,.15);
}

.unlock-scratch-btn:active {
  transform: scale(.985);
}

/* =========================================================
   LOYALTY
========================================================= */

.loyalty-card {
  padding: 27px 26px;
}

.loyalty-progress-row {
  width: 100%;

  display: flex;
  align-items: center;
  gap: 12px;

  margin: 26px 0 18px;
}

.loyalty-dot {
  flex: 1;

  width: 100%;
  max-width: 50px;
  min-width: 35px;
  aspect-ratio: 1;

  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #17314b;

  border: 1px solid rgba(150,180,210,.2);

  color: rgba(255,255,255,.55);

  font-size: 15px;
  font-weight: 700;
}

.loyalty-dot.active {
  background: linear-gradient(
    135deg,
    #ff7658,
    #ff925b
  );

  border-color: #ff7658;
  color: #fff;
}

.loyalty-status-text {
  color: rgba(255,255,255,.6);
  font-size: 14px;
  line-height: 1.4;
}

.loyalty-status-text strong {
  color: #fff;
}

/* =========================================================
   BILL / ORDER SUMMARY
========================================================= */

.bill-card {
  padding: 28px 26px;
}

.bill-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bill-line {
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 20px;
  padding: 9px 0;

  box-sizing: border-box;
}

.bill-line > span {
  flex: 1;
  min-width: 0;

  color: rgba(255,255,255,.62);

  font-size: 16px;
  line-height: 1.4;

  overflow-wrap: anywhere;
}

.bill-line > strong {
  flex: 0 0 auto;

  white-space: nowrap;

  color: #fff;

  font-size: 17px;
  font-weight: 800;

  text-align: right;
}

.bill-divider {
  height: 1px;

  margin: 12px 0;

  background: rgba(255,255,255,.09);
}

.discount-line > span,
.discount-line > strong {
  color: #5ee39a;
}

.total-line {
  margin-top: 6px;
  padding-top: 17px;
}

.total-line > span {
  color: #fff;

  font-size: 19px;
  font-weight: 800;
}

.total-line > strong {
  color: #fff;

  font-size: 22px;
  font-weight: 900;
}

/* =========================================================
   BOTTOM CHECKOUT
========================================================= */

.checkout-bottom {
  width: 100%;
  box-sizing: border-box;

  padding: 4px 2px;
}

.checkout-total-mini {
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 15px;

  margin-bottom: 12px;
}

.checkout-total-mini span {
  color: rgba(255,255,255,.72);
  font-size: 18px;
}

.checkout-total-mini strong {
  color: #fff;
  font-size: 23px;
  white-space: nowrap;
}

.place-order-btn {
  width: 100%;
  min-height: 60px;

  padding: 14px 18px;

  border: 0;
  border-radius: 18px;

  background: linear-gradient(
    135deg,
    #ff6d55,
    #ff8d59
  );

  color: #fff;

  font-size: 17px;
  font-weight: 800;

  box-shadow:
    0 10px 25px rgba(255,100,75,.18);

  cursor: pointer;

  transition:
    transform .18s ease,
    opacity .18s ease;
}

.place-order-btn:not(:disabled):active {
  transform: scale(.985);
}

.place-order-btn:disabled {
  opacity: .42;
  cursor: not-allowed;
  box-shadow: none;
}

.checkout-secure-note {
  display: block;

  margin-top: 12px;

  color: rgba(255,255,255,.52);

  text-align: center;

  font-size: 13px;
  line-height: 1.4;
}

/* =========================================================
   REMOVE DEFAULT BUTTON / INPUT STYLING
========================================================= */

.checkout-page button {
  font-family: inherit;
}

.checkout-page button:not(.place-order-btn):not(.unlock-scratch-btn) {
  -webkit-appearance: none;
  appearance: none;
}

/* =========================================================
   MAP SAFETY
========================================================= */

.checkout-page .leaflet-container {
  width: 100%;
  min-height: 280px;

  border-radius: 20px;
  overflow: hidden;
}

/* =========================================================
   MOBILE
========================================================= */

@media (max-width: 600px) {

  .checkout-page {
    max-width: 100%;
    padding: 12px 12px 115px;
  }

  .checkout-card {
    padding: 22px 18px;
    border-radius: 27px;
    margin-bottom: 15px;
  }

  /* ---------- headings ---------- */

  .section-heading {
    gap: 14px;
    margin-bottom: 20px;
  }

  .section-icon {
    width: 55px;
    height: 55px;
    min-width: 55px;
    border-radius: 18px;
    font-size: 25px;
  }

  .section-kicker {
    font-size: 12px;
    letter-spacing: 1.8px;
  }

  .section-heading h2 {
    font-size: 23px;
  }

  .section-heading p {
    font-size: 13px;
  }

  /* ---------- order type ---------- */

  .order-type-options {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .order-type-option {
    min-height: 82px;
    padding: 12px 14px;
    border-radius: 20px;
  }

  .order-type-icon {
    width: 50px;
    height: 50px;
    min-width: 50px;

    border-radius: 16px;
    font-size: 24px;
  }

  .order-type-content strong {
    font-size: 17px;
  }

  .order-type-content small {
    font-size: 12px;
  }

  .order-type-radio {
    width: 38px;
    height: 38px;
    min-width: 38px;
  }

  /* ---------- payment ---------- */

  .payment-options {
    gap: 11px;
  }

  .payment-option {
    min-height: 92px;

    padding: 13px 14px;

    grid-template-columns:
      54px
      minmax(0, 1fr)
      42px;

    gap: 12px;

    border-radius: 24px;
  }

  .payment-option-icon {
    width: 54px;
    height: 54px;

    border-radius: 17px;
    font-size: 25px;
  }

  .payment-option strong {
    font-size: 17px;
  }

  .payment-option small {
    font-size: 13px;
  }

  .radio-modern {
    width: 40px;
    height: 40px;
  }

  /* ---------- customer ---------- */

  .customer-profile-box {
    gap: 13px;
  }

  .customer-avatar {
    width: 56px;
    height: 56px;
    min-width: 56px;

    border-radius: 18px;
    font-size: 27px;
  }

  .customer-profile-box strong {
    font-size: 18px;
  }

  .customer-profile-box span {
    font-size: 14px;
  }

  /* ---------- address ---------- */

  .address-preview {
    padding: 14px;
    border-radius: 17px;
  }

  .address-preview-content > strong {
    font-size: 14px;
  }

  /* ---------- loyalty ---------- */

  .loyalty-card {
    padding: 23px 18px;
  }

  .loyalty-progress-row {
    gap: 7px;
    margin: 22px 0 15px;
  }

  .loyalty-dot {
    min-width: 30px;
    max-width: 43px;
    font-size: 13px;
  }

  /* ---------- bill ---------- */

  .bill-card {
    padding: 24px 18px;
  }

  .bill-line {
    gap: 12px;
    padding: 8px 0;
  }

  .bill-line > span {
    font-size: 15px;
  }

  .bill-line > strong {
    font-size: 16px;
  }

  .total-line > span {
    font-size: 18px;
  }

  .total-line > strong {
    font-size: 21px;
  }

  /* ---------- textarea ---------- */

  .checkout-card textarea,
  .special-instructions textarea {
    min-height: 105px;
    font-size: 14px;
  }

  /* ---------- bottom ---------- */

  .checkout-total-mini span {
    font-size: 16px;
  }

  .checkout-total-mini strong {
    font-size: 22px;
  }

  .place-order-btn {
    min-height: 58px;
    font-size: 16px;
    border-radius: 18px;
  }

  .checkout-secure-note {
    font-size: 12px;
  }
}

/* =========================================================
   VERY SMALL PHONES
========================================================= */

@media (max-width: 380px) {

  .checkout-page {
    padding-left: 9px;
    padding-right: 9px;
  }

  .checkout-card {
    padding-left: 15px;
    padding-right: 15px;
  }

  .section-heading {
    gap: 10px;
  }

  .section-icon {
    width: 50px;
    height: 50px;
    min-width: 50px;
  }

  .section-heading h2 {
    font-size: 21px;
  }

  .payment-option {
    grid-template-columns: 50px minmax(0,1fr) 38px;
    gap: 9px;
  }

  .payment-option-icon {
    width: 50px;
    height: 50px;
  }

  .radio-modern {
    width: 36px;
    height: 36px;
  }

  .loyalty-dot {
    min-width: 27px;
  }
}
