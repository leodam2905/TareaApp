import { useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import JobDetailsScreen, { Job } from "@/components/JobDetailsScreen";

export default function JobRequestDetailRoute() {
  const router = useRouter();
  const { job: jobParam } = useLocalSearchParams<{ job?: string }>();

  const job = useMemo<Job | undefined>(() => {
    if (!jobParam) return undefined;
    try { return JSON.parse(jobParam) as Job; } catch { return undefined; }
  }, [jobParam]);

  return (
    <JobDetailsScreen
      job={job}
      onBack={() => router.back()}
      onSubmitInterest={async (selected) => {
        // "I'm interested" = apply to this job request. Throws on failure so the
        // screen shows its error alert; resolves to show the success state.
        const res = await api.post(`/job-requests/${selected.id}/apply`, { message: null, proposedPrice: null });
        if (!res.ok) {
          let msg = "Your interest could not be submitted.";
          try { msg = (await res.json())?.error || msg; } catch { /* ignore */ }
          throw new Error(msg);
        }
      }}
    />
  );
}
