import React, { useEffect, useState, useRef } from "react";
import { Fab, Zoom } from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { styled } from "@mui/material/styles";

// Estilos para el FAB: negro elegante, texto blanco, efecto moderno
const StyledFab = styled(Fab)(({ theme }) => ({
  position: "fixed",
  left: "50%",
  bottom: 32,
  transform: "translateX(-50%)",
  zIndex: 2000,
  background: "#181818",
  color: "#fff",
  fontWeight: 700,
  fontSize: 22,
  letterSpacing: 1,
  boxShadow: "0 8px 32px #2226",
  border: "3px solid #fff",
  transition: "all .25s cubic-bezier(.4,0,.2,1)",
  "&:hover": {
    background: "#fff",
    color: "#111",
    border: "3px solid #181818",
    boxShadow: "0 14px 36px #1119",
  },
}));

/**
 * El FAB solo aparece si:
 * - El usuario scrollea después de la sección de productos
 * - Y solo si está bajando
 * - Se oculta si sube o si vuelve arriba de la sección
 */
export default function FabAddProduct({ onClick, containerId = "seccion-productos" }) {
  const [visible, setVisible] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    const section = document.getElementById(containerId);
    let sectionBottom = 0;
    if (section) {
      const rect = section.getBoundingClientRect();
      sectionBottom = rect.bottom + window.scrollY;
    }

    const handleScroll = () => {
      const currScroll = window.scrollY;
      // Solo mostrar si hemos pasado la sección de productos
      if (currScroll > sectionBottom) {
        setVisible(currScroll > lastScroll.current); // Solo al bajar
      } else {
        setVisible(false);
      }
      lastScroll.current = currScroll;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [containerId]);

  return (
    <Zoom in={visible}>
      <StyledFab size="large" onClick={onClick} aria-label="Agregar producto">
        <AddCircleOutlineIcon sx={{ fontSize: 34, mr: 1 }} />
        <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: 1 }}>
          Agregar
        </span>
      </StyledFab>
    </Zoom>
  );
}
