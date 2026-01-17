import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/home";
import RehashOptimizerPage from "./pages/rehash-optimizer";
import NotFound from "./pages/not-found";
import { VehicleDetailPage } from "./pages/vehicle-detail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
      <Route path="/rehash-optimizer" element={<RehashOptimizerPage />} />
      <Route path="/rehash" element={<Navigate to="/rehash-optimizer" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
