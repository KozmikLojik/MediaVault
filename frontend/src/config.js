const config = {
  API_URL: (import.meta.env.VITE_API_URL || "https://mediavault-backend-vxsb.onrender.com").replace(/\/+$/, "")
};

export default config;
