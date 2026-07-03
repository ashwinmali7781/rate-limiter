import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Rules } from "./pages/Rules";
import { Logs } from "./pages/Logs";
import { ApiKeys } from "./pages/ApiKeys";
import { SignInPage } from "./pages/SignInPage";
import { useApiAuth } from "./hooks/useApiAuth";

function ProtectedShell() {
  useApiAuth();
  return (
    <>
      <SignedIn>
        <AppShell />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/keys" element={<ApiKeys />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
