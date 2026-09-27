import { createContext, useState, useCallback } from 'react';

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [total, setTotal] = useState(0);

  const addToCart = useCallback((productId, quantity = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === productId);
      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevCart, { productId, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartId(null);
    setTotal(0);
  }, []);

  const syncCart = useCallback((newCartId, newTotal) => {
    setCartId(newCartId);
    setTotal(newTotal);
  }, []);

  const value = {
    cart,
    cartId,
    total,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    syncCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
