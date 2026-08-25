"use client";

import {
  Archive,
  Edit3,
  Pin,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "../format";
import {
  archivePlatformRelease,
  assignTenantReleaseChannel,
  createPlatformRelease,
  getTenantReleaseAssignment,
  listPlatformReleases,
  publishPlatformRelease,
  updatePlatformRelease,
  validateReleaseInput,
  type PlatformRelease,
  type ReleaseChannel,
  type ReleaseInput,
  type ReleaseStatus,
  type TenantReleaseAssignment,
  type TenantReleaseChannel,
} from "../releases";
import { validateTenantId } from "../subscriptions";

const emptyRelease: ReleaseInput = {
  version: "",
  channel: "stable",
  releaseNotes: null,
  minimumSupportedVersion: null,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function StatusBadge({ status }: { status: ReleaseStatus }) {
  const styles =
    status === "published"
      ? "bg-emerald-50 text-emerald-700"
      : status === "draft"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

export function ReleaseConsole() {
  const [releases, setReleases] = useState<PlatformRelease[]>([]);
  const [publishedOptions, setPublishedOptions] = useState<PlatformRelease[]>([]);
  const [channelFilter, setChannelFilter] = useState<ReleaseChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [releaseForm, setReleaseForm] = useState<ReleaseInput>(emptyRelease);
  const [saving, setSaving] = useState(false);

  const [tenantInput, setTenantInput] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<TenantReleaseAssignment | null>(null);
  const [assignmentChannel, setAssignmentChannel] =
    useState<TenantReleaseChannel>("stable");
  const [pinnedReleaseId, setPinnedReleaseId] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visibleReleases, assignmentOptions] = await Promise.all([
        listPlatformReleases({
          channel: channelFilter === "all" ? undefined : channelFilter,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        listPlatformReleases({ status: "published" }),
      ]);
      setReleases(visibleReleases);
      setPublishedOptions(assignmentOptions);
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not load release metadata."));
    } finally {
      setLoading(false);
    }
  }, [channelFilter, statusFilter]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const resetReleaseForm = () => {
    setEditingId(null);
    setReleaseForm({ ...emptyRelease });
    setFeedback(null);
  };

  const editRelease = (release: PlatformRelease) => {
    setEditingId(release.id);
    setReleaseForm({
      version: release.version,
      channel: release.channel,
      releaseNotes: release.releaseNotes,
      minimumSupportedVersion: release.minimumSupportedVersion,
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRelease = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized: ReleaseInput = {
      version: releaseForm.version.trim(),
      channel: releaseForm.channel,
      releaseNotes: releaseForm.releaseNotes?.trim() || null,
      minimumSupportedVersion:
        releaseForm.minimumSupportedVersion?.trim() || null,
    };
    const validationError = validateReleaseInput(normalized);
    if (validationError) {
      setFeedback(validationError);
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (editingId) await updatePlatformRelease(editingId, normalized);
      else await createPlatformRelease(normalized);
      resetReleaseForm();
      await loadReleases();
    } catch (requestError) {
      setFeedback(errorMessage(requestError, "Could not save the release."));
    } finally {
      setSaving(false);
    }
  };

  const publishRelease = async (release: PlatformRelease) => {
    if (!window.confirm(`Publish release ${release.version} to the ${release.channel} channel?`)) return;
    try {
      await publishPlatformRelease(release.id);
      await loadReleases();
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not publish the release."));
    }
  };

  const archiveRelease = async (release: PlatformRelease) => {
    if (!window.confirm(`Archive release ${release.version}?`)) return;
    try {
      await archivePlatformRelease(release.id);
      if (editingId === release.id) resetReleaseForm();
      await loadReleases();
    } catch (requestError) {
      setError(errorMessage(requestError, "Could not archive the release."));
    }
  };

  const loadAssignment = async () => {
    const parsed = validateTenantId(tenantInput);
    if (!parsed.success) {
      setAssignmentError(parsed.error.issues[0]?.message ?? "Invalid tenant ID.");
      return;
    }
    setAssignmentLoading(true);
    setAssignmentError(null);
    setAssignmentFeedback(null);
    setSelectedTenantId(parsed.data);
    try {
      const current = await getTenantReleaseAssignment(parsed.data);
      setAssignment(current);
      setAssignmentChannel(current.channel);
      setPinnedReleaseId(current.pinnedReleaseId ?? "");
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setAssignment(null);
        setAssignmentChannel("stable");
        setPinnedReleaseId("");
        setAssignmentFeedback(
          "No channel assignment was found. Save a channel to create one.",
        );
      } else {
        setAssignmentError(
          errorMessage(requestError, "Could not load the tenant release channel."),
        );
      }
    } finally {
      setAssignmentLoading(false);
    }
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTenantId) {
      setAssignmentError("Load a tenant before assigning a release channel.");
      return;
    }
    if (assignmentChannel === "pinned" && !pinnedReleaseId) {
      setAssignmentError("Select a published release for the pinned channel.");
      return;
    }
    setAssignmentLoading(true);
    setAssignmentError(null);
    try {
      await assignTenantReleaseChannel(
        selectedTenantId,
        assignmentChannel,
        pinnedReleaseId || null,
      );
      const current = await getTenantReleaseAssignment(selectedTenantId);
      setAssignment(current);
      setAssignmentFeedback("Tenant release channel updated.");
    } catch (requestError) {
      setAssignmentError(errorMessage(requestError, "Could not assign the release channel."));
    } finally {
      setAssignmentLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-brand-700">Web update metadata</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Release management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage release metadata and tenant channels. Publishing does not execute a deployment.
        </p>
      </header>

      <section className="grid gap-7 border-t border-slate-200 pt-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <form onSubmit={saveRelease} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit release" : "New release"}
            </h2>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetReleaseForm}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            ) : null}
          </div>
          {feedback ? <Alert variant="error">{feedback}</Alert> : null}
          <FormField label="Version" htmlFor="release-version">
            <Input
              id="release-version"
              value={releaseForm.version}
              onChange={(event) =>
                setReleaseForm((current) => ({ ...current, version: event.target.value }))
              }
              placeholder="1.2.3"
              disabled={
                editingId !== null &&
                releases.find((release) => release.id === editingId)?.status === "published"
              }
            />
          </FormField>
          <FormField label="Channel" htmlFor="release-channel">
            <Select
              id="release-channel"
              value={releaseForm.channel}
              onChange={(event) =>
                setReleaseForm((current) => ({
                  ...current,
                  channel: event.target.value as ReleaseChannel,
                }))
              }
              disabled={
                editingId !== null &&
                releases.find((release) => release.id === editingId)?.status === "published"
              }
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </Select>
          </FormField>
          <FormField label="Minimum supported version" htmlFor="release-minimum">
            <Input
              id="release-minimum"
              value={releaseForm.minimumSupportedVersion ?? ""}
              onChange={(event) =>
                setReleaseForm((current) => ({
                  ...current,
                  minimumSupportedVersion: event.target.value || null,
                }))
              }
              placeholder="1.0.0"
            />
          </FormField>
          <FormField label="Release notes" htmlFor="release-notes">
            <textarea
              id="release-notes"
              rows={7}
              value={releaseForm.releaseNotes ?? ""}
              onChange={(event) =>
                setReleaseForm((current) => ({
                  ...current,
                  releaseNotes: event.target.value || null,
                }))
              }
              className="w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </FormField>
          <Button type="submit" isLoading={saving} className="w-full">
            {editingId ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Save metadata" : "Create draft"}
          </Button>
        </form>

        <div className="border-l border-slate-200 pl-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Releases</h2>
              <p className="mt-1 text-sm text-slate-500">Metadata ordered by creation time.</p>
            </div>
            <div className="flex gap-2">
              <Select aria-label="Filter release channel" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as ReleaseChannel | "all")} className="w-32">
                <option value="all">All channels</option>
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
              </Select>
              <Select aria-label="Filter release status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReleaseStatus | "all")} className="w-32">
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>
          {error ? (
            <div className="mt-4 flex items-center gap-3">
              <Alert variant="error">{error}</Alert>
              <Button variant="outline" size="icon" title="Retry" aria-label="Retry" onClick={() => void loadReleases()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading releases...</p>
            ) : releases.length === 0 ? (
              <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">No releases match these filters.</div>
            ) : (
              releases.map((release) => (
                <article key={release.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Rocket className="h-4 w-4 text-slate-400" />
                        <h3 className="font-semibold text-slate-900">v{release.version}</h3>
                        <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium capitalize text-sky-700">{release.channel}</span>
                        <StatusBadge status={release.status} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {release.releaseNotes || "No release notes."}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        Minimum {release.minimumSupportedVersion ?? "not set"} | Published {formatDateTime(release.publishedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {release.status !== "archived" ? (
                        <Button type="button" size="icon" variant="ghost" title="Edit release" aria-label={`Edit release ${release.version}`} onClick={() => editRelease(release)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {release.status === "draft" ? (
                        <Button type="button" size="icon" variant="ghost" title="Publish release" aria-label={`Publish release ${release.version}`} onClick={() => void publishRelease(release)}>
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {release.status !== "archived" ? (
                        <Button type="button" size="icon" variant="ghost" title="Archive release" aria-label={`Archive release ${release.version}`} onClick={() => void archiveRelease(release)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenant release channel</h2>
          <p className="mt-1 text-sm text-slate-500">
            Assign stable, beta, or a specific published release to one tenant.
          </p>
        </div>
        <div className="mt-4 flex max-w-2xl gap-3">
          <Input aria-label="Tenant ID for release assignment" value={tenantInput} onChange={(event) => setTenantInput(event.target.value)} placeholder="Tenant UUID" />
          <Button type="button" variant="outline" isLoading={assignmentLoading} onClick={() => void loadAssignment()}>
            <Search className="h-4 w-4" /> Load
          </Button>
        </div>
        {assignmentError ? <div className="mt-4"><Alert variant="error">{assignmentError}</Alert></div> : null}
        {assignmentFeedback ? <div className="mt-4"><Alert>{assignmentFeedback}</Alert></div> : null}
        {selectedTenantId ? (
          <form onSubmit={saveAssignment} className="mt-5 grid max-w-3xl items-end gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
            <FormField label="Channel" htmlFor="tenant-release-channel">
              <Select id="tenant-release-channel" value={assignmentChannel} onChange={(event) => setAssignmentChannel(event.target.value as TenantReleaseChannel)}>
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
                <option value="pinned">Pinned release</option>
              </Select>
            </FormField>
            <FormField label="Pinned release" htmlFor="tenant-pinned-release">
              <Select id="tenant-pinned-release" value={pinnedReleaseId} disabled={assignmentChannel !== "pinned"} onChange={(event) => setPinnedReleaseId(event.target.value)}>
                <option value="">Select published release</option>
                {publishedOptions.map((release) => (
                  <option key={release.id} value={release.id}>v{release.version} ({release.channel})</option>
                ))}
              </Select>
            </FormField>
            <Button type="submit" isLoading={assignmentLoading}>
              <Pin className="h-4 w-4" /> Save assignment
            </Button>
          </form>
        ) : null}
        {assignment ? (
          <div className="mt-5 flex max-w-3xl items-center justify-between border-y border-slate-200 py-4 text-sm">
            <div>
              <p className="font-medium capitalize text-slate-900">{assignment.channel} channel</p>
              <p className="mt-1 text-slate-500">Tenant {assignment.tenantId}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-slate-900">
                {assignment.resolvedRelease ? `Resolved v${assignment.resolvedRelease.version}` : "No published release resolved"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Metadata assignment only</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
