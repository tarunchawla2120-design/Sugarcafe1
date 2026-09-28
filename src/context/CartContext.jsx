import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const savedCart =
      localStorage.getItem("sugarCafeCart");

    return savedCart
      ? JSON.parse(savedCart)
      : [];
  });

  const addToCart = (item) => {
    console.log("Cart Updated");

    const exist = cart.find(
      (x) => x.id === item.id
    );

    if (exist) {
      setCart(
        cart.map((x) =>
          x.id === item.id
            ? {
                ...x,
                qty: Number(x.qty || 0) + 1,
              }
            : x
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...item,
          qty: 1,
        },
      ]);
    }
  };

  const increaseQty = (id) => {
    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: Number(item.qty || 0) + 1,
            }
          : item
      )
    );
  };

  const decreaseQty = (id) => {
    setCart(
      cart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                qty: Number(item.qty || 0) - 1,
              }
            : item
        )
        .filter(
          (item) => Number(item.qty || 0) > 0
        )
    );
  };

  const removeFromCart = (id) => {
    setCart(
      cart.filter(
        (item) => item.id !== id
      )
    );
  };

  /* =========================================
     CHECKOUT COMPATIBILITY
  ========================================= */

  const cartItems = cart.map((item) => ({
    ...item,

    // Existing Cart uses qty
    // New Checkout uses quantity
    quantity: Number(
      item.qty ||
        item.quantity ||
        1
    ),
  }));

  const clearCart = () => {
    setCart([]);
  };

  /* =========================================
     TOTALS
  ========================================= */

  const totalItems = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.qty || 0),
    0
  );

  const totalPrice = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.qty || 0),
    0
  );

  /* =========================================
     SAVE CART
  ========================================= */

  useEffect(() => {
    localStorage.setItem(
      "sugarCafeCart",
      JSON.stringify(cart)
    );
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        /* Existing */
        cart,
        addToCart,
        increaseQty,
        decreaseQty,
        removeFromCart,

        /* Checkout compatibility */
        cartItems,
        clearCart,

        /* Totals */
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;
