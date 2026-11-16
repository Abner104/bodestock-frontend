import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase"; // ajusta tu import

export default function DynamicIsland() {
  const [lowStockProduct, setLowStockProduct] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "productos"), (snapshot) => {
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.stock <= 5) {
          setLowStockProduct({ name: data.nombre, stock: data.stock });
          setVisible(true);
          setTimeout(() => setVisible(false), 4000); // desaparece después de 4s
        }
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ width: 80, height: 40, opacity: 0, borderRadius: 9999 }}
            animate={{
              width: 300,
              height: 60,
              opacity: 1,
              borderRadius: 50,
            }}
            exit={{ width: 80, height: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}
            className="bg-zinc-900 text-white flex items-center justify-center shadow-lg backdrop-blur-xl"
          >
            <AlertTriangle className="text-yellow-400 mr-2" size={20} />
            <div className="text-sm">
              <p className="font-semibold">Stock bajo</p>
              <p>
                {lowStockProduct?.name} —{" "}
                <span className="text-yellow-300">
                  {lowStockProduct?.stock} unidades
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
