// src/components/ui/Logo.jsx
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
const logoBodestock = '/logoo.png';

const Logo = ({ size = 'md', onClick = null, animated = true }) => {
  const sizes = {
    xs: {
      container: 'w-16 h-14',
      logo: 'w-full h-full',
    },
    sm: {
      container: 'w-20 h-16',
      logo: 'w-full h-full',
    },
    md: {
      container: 'w-28 h-24',
      logo: 'w-full h-full',
    },
    lg: {
      container: 'w-40 h-32',
      logo: 'w-full h-full',
    },
    xl: {
      container: 'w-56 h-48',
      logo: 'w-full h-full',
    },
    '2xl': {
      container: 'w-72 h-60',
      logo: 'w-full h-full',
    }
  };

  const currentSize = sizes[size] || sizes.md;

  // Variantes de animación
  const containerVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    },
    hover: onClick ? {
      scale: 1.05,
      transition: { duration: 0.2 }
    } : {},
    tap: onClick ? { scale: 0.95 } : {}
  };

  const logoVariants = {
    initial: { opacity: 0, y: -20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      variants={animated ? containerVariants : {}}
      initial={animated ? "initial" : false}
      animate={animated ? "animate" : false}
      whileHover={animated ? "hover" : {}}
      whileTap={animated ? "tap" : {}}
      onClick={onClick}
      className={`flex items-center justify-center ${currentSize.container} ${onClick ? 'cursor-pointer' : ''} relative`}
    >
      {/* Logo original - sin efectos */}
      <motion.img
        variants={animated ? logoVariants : {}}
        src={logoBodestock}
        alt="Bodestock Logo"
        className={`${currentSize.logo} object-contain relative z-10`}
      />
    </motion.div>
  );
};

Logo.propTypes = {
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),
  onClick: PropTypes.func,
  animated: PropTypes.bool,
};

Logo.defaultProps = {
  size: 'md',
  onClick: null,
  animated: true,
};

export default Logo;
