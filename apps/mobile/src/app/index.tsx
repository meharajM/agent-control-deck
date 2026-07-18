import { Redirect } from "expo-router";

/**
 * Root index — redirect to the sessions list.
 * In a future milestone this will redirect to the Attention screen when there
 * are pending approvals/questions (per product spec §5).
 */
export default function Index() {
  return <Redirect href="/sessions" />;
}
