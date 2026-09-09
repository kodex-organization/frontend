"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/features/platform-admin/format";
import {
  canDownloadExport,
  downloadDataExport,
  formatExportSize,
  listDataExports,
  requestDataExport,
  type DataExportJob,
  type DataExportStatus,
} from "../data-exports";

function statusStyle(status: DataExportStatus) {
  if (status === "completed") return "bg-brand-50 text-brand-700";
  if (status === "failed" || status === "expired") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function StatusIcon({ status }: { status: DataExportStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "failed" || status === "expired") return <XCircle className="h-4 w-4" />;
  return <LoaderCircle className={`h-4 w-4 ${status === "running" ? "animate-spin" : ""}`} />;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DataExportScreen() {
  const [jobs, setJobs] = useState<DataExportJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<DataExportStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmRequest, setConfirmRequest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const page = await listDataExports(
        statusFilter === "all" ? undefined : statusFilter,
      );
      setJobs(page.items);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load data exports.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPendingJobs = useMemo(
    () => jobs.some((job) => job.status === "queued" || job.status === "running"),
    [jobs],
  );

  useEffect(() => {
    if (!hasPendingJobs) return;
    const timer = window.setInterval(() => void load(true), 5_000);
    return () => window.clearInterval(timer);
  }, [hasPendingJobs, load]);

  const requestExport = async () => {
    setRequesting(true);
    setError(null);
    setFeedback(null);
    try {
      const job = await requestDataExport();
      setFeedback(`Export ${job.id} was queued.`);
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not request the data export.",
      );
    } finally {
      setRequesting(false);
      setConfirmRequest(false);
    }
  };

  const download = async (job: DataExportJob) => {
    if (!canDownloadExport(job)) {
      setError(
        job.status === "expired"
          ? "This export has expired. Request a new export."
          : "This export is not available for download.",
      );
      return;
    }
    setDownloadingId(job.id);
    setError(null);
    setFeedback(null);
    try {
      const artifact = await downloadDataExport(job.id);
      triggerDownload(artifact.blob, artifact.fileName);
      setFeedback(`Downloaded ${artifact.fileName}.`);
    } catch (requestError) {
      if (
        requestError instanceof ApiError &&
        (requestError.status === 410 || requestError.code === "DATA_EXPORT_EXPIRED")
      ) {
        setError("This export has expired. Request a new export.");
        await load(true);
      } else {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Could not download the export.",
        );
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-700">Data portability</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Tenant data exports</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Request a server-generated export and download it before its authorization window expires.
          </p>
        </div>
        <Button type="button" isLoading={requesting} onClick={() => setConfirmRequest(true)}>
          <FileArchive className="h-4 w-4" /> Request JSON export
        </Button>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {feedback ? <Alert variant="success">{feedback}</Alert> : null}

      <ConfirmModal
        isOpen={confirmRequest}
        title="Request data export"
        description="Request a new JSON export of your tenant business data?"
        confirmText="Request export"
        cancelText="Cancel"
        variant="primary"
        isLoading={requesting}
        onConfirm={() => void requestExport()}
        onCancel={() => setConfirmRequest(false)}
      />

      <section className="border-t border-slate-200 pt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Export history</h2>
            <p className="mt-1 text-sm text-slate-500">Queued and running exports refresh automatically.</p>
          </div>
          <div className="flex gap-2">
            <Select aria-label="Filter export status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DataExportStatus | "all")} className="w-40">
              <option value="all">All status</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </Select>
            <Button type="button" variant="outline" size="icon" title="Refresh exports" aria-label="Refresh exports" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading export history...</p>
          ) : jobs.length === 0 ? (
            <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">No exports match this status.</div>
          ) : (
            jobs.map((job) => (
              <article key={job.id} className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium capitalize ${statusStyle(job.status)}`}>
                        <StatusIcon status={job.status} /> {job.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">{job.format}</span>
                    </div>
                    <p className="mt-3 break-all font-mono text-xs text-slate-500">{job.id}</p>
                    {job.failureReason ? (
                      <p className="mt-2 flex items-center gap-2 text-sm font-medium text-red-700"><AlertCircle className="h-4 w-4" /> {job.failureReason}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canDownloadExport(job)}
                    isLoading={downloadingId === job.id}
                    onClick={() => void download(job)}
                    title={job.status === "expired" ? "Export expired" : "Download authorized export"}
                  >
                    <Download className="h-4 w-4" /> Download
                  </Button>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
                  <div><dt className="text-slate-500">Requested</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(job.requestedAt)}</dd></div>
                  <div><dt className="text-slate-500">Completed</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(job.completedAt)}</dd></div>
                  <div><dt className="text-slate-500">Expires</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(job.expiresAt)}</dd></div>
                  <div><dt className="text-slate-500">Size</dt><dd className="mt-1 font-medium text-slate-800">{formatExportSize(job.sizeBytes)}</dd></div>
                  <div className="sm:col-span-2 xl:col-span-4"><dt className="text-slate-500">SHA-256 checksum</dt><dd className="mt-1 break-all font-mono text-slate-700">{job.checksumSha256 ?? "Unavailable until completion"}</dd></div>
                </dl>
              </article>
            ))
          )}
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Clock3 className="h-4 w-4" /> Downloads are checked against your current OWNER session and tenant at request time.
      </p>
    </div>
  );
}
