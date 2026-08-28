import { TripApp } from "./TripApp";

export default async function TripPage({ params }: { params: Promise<{ inviteToken: string }> }) {
  const { inviteToken } = await params;
  return <TripApp inviteToken={inviteToken} />;
}
