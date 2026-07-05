import { redirect } from "next/navigation";

// task.pdf: "The only unauthenticated page is Login." Root "/" is not a
// marketing page — send everyone straight to sign-in. Once Developer 2's
// <ProtectedRoute> ships, authenticated users hitting "/" can be redirected
// to their role's home screen instead; for now this keeps the app scope-compliant.
export default function HomePage() {
  redirect("/login");
}
