import { Routes, Route } from "react-router-dom";

import Home from "./pages/home";
import RehashOptimizerPage from "./pages/rehash-optimizer";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/rehash-optimizer" element={<RehashOptimizerPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
