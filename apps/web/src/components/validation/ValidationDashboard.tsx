/**
 * Validation Dashboard Component (Phase 7.5)
 *
 * Displays validation results with approval/rejection controls and rerun capability.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ValidationRun {
  id: string;
  generationRunId: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'partial';
  promotionBlocked: boolean;
  results: ValidationCheckResult[];
  createdAt: string;
}

interface ValidationCheckResult {
  checkType: string;
  status: 'passed' | 'failed' | 'skipped';
  testSummary?: string;
  issueCount: number;
  blocksPromotion: boolean;
  evidenceUrl?: string;
}

interface ApprovalDecision {
  id: string;
  decision: 'approved' | 'rejected';
  approvedBy: string;
  decidedAt: string;
  reason: string;
  comments?: string;
  requiresSecondApproval: boolean;
}

export function ValidationDashboard({ generationRunId }: { generationRunId: string }) {
  const [validationRuns, setValidationRuns] = useState<ValidationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Fetch validation runs for this generation
  useEffect(() => {
    const fetchValidationRuns = async () => {
      try {
        const response = await fetch(
          `/api/validation-runs?generationRunId=${generationRunId}`
        );
        if (response.ok) {
          const data = await response.json();
          setValidationRuns(data.validationRuns || []);
        }
      } catch (err) {
        console.error('Failed to fetch validation runs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchValidationRuns();
  }, [generationRunId]);

  const handleApprove = async (validationRunId: string, requiresSecondApproval: boolean) => {
    try {
      const response = await fetch(`/api/validation-runs/${validationRunId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          reason: 'Validation checks passed, ready for promotion',
          requiresSecondApproval,
        }),
      });

      if (response.ok) {
        alert('Approval submitted successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to submit approval'}`);
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to submit approval');
    }
  };

  const handleReject = async (validationRunId: string, reason: string) => {
    try {
      const response = await fetch(`/api/validation-runs/${validationRunId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'rejected',
          reason,
        }),
      });

      if (response.ok) {
        alert('Rejection submitted successfully');
        // Refresh validation runs
        const newResponse = await fetch(
          `/api/validation-runs?generationRunId=${generationRunId}`
        );
        if (newResponse.ok) {
          const data = await newResponse.json();
          setValidationRuns(data.validationRuns || []);
        }
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to submit rejection'}`);
      }
    } catch (err) {
      console.error('Reject error:', err);
      alert('Failed to submit rejection');
    }
  };

  const handleRerun = async (validationRunId: string, feedback: string) => {
    try {
      const response = await fetch(`/api/validation-runs/${validationRunId}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      if (response.ok) {
        alert('Rerun request submitted successfully');
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Failed to submit rerun request'}`);
      }
    } catch (err) {
      console.error('Rerun error:', err);
      alert('Failed to submit rerun request');
    }
  };

  if (loading) {
    return <div className="p-4">Loading validation results...</div>;
  }

  const hasAnyFailures = validationRuns.some(run =>
    run.results.some(r => r.status === 'failed')
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Validation Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review validation results and approve/reject generated changes for promotion.
        </p>
      </header>

      {validationRuns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">No validation runs found for this generation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {validationRuns.map(run => (
            <ValidationRunCard
              key={run.id}
              run={run}
              selectedRunId={selectedRunId}
              onSelectRun={() => setSelectedRunId(run.id)}
              onApprove={(requiresSecondApproval) => handleApprove(run.id, requiresSecondApproval)}
              onReject={(reason) => handleReject(run.id, reason)}
              onRerun={(feedback) => handleRerun(run.id, feedback)}
            />
          ))}
        </div>
      )}

      {hasAnyFailures && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ Some validation checks have failed. Please review and either reject, request reruns with feedback, or override if appropriate.
          </p>
        </div>
      )}
    </div>
  );
}

function ValidationRunCard({
  run,
  selectedRunId,
  onSelectRun,
  onApprove,
  onReject,
  onRerun,
}: {
  run: ValidationRun;
  selectedRunId: string | null;
  onSelectRun: () => void;
  onApprove: (requiresSecondApproval: boolean) => void;
  onReject: (reason: string) => void;
  onRerun: (feedback: string) => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRerunForm, setShowRerunForm] = useState(false);
  const [rerunFeedback, setRerunFeedback] = useState('');

  const hasFailures = run.results.some(r => r.status === 'failed');
  const hasWarnings = run.results.some(r => r.status !== 'failed' && r.issueCount > 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={onSelectRun}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <div>
          <span className="text-sm font-medium text-gray-900">Validation Run #{run.id.slice(0, 8)}</span>
          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
            run.status === 'passed' ? 'bg-green-100 text-green-800' :
            run.status === 'failed' ? 'bg-red-100 text-red-800' :
            run.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {run.status.toUpperCase()}
          </span>
        </div>
        <svg className={`w-5 h-5 transition-transform ${selectedRunId === run.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {selectedRunId === run.id && (
        <div className="px-4 pb-4 border-t">
          {/* Results Summary */}
          <div className="mt-4 space-y-2">
            {run.results.map((result, idx) => (
              <div key={idx} className={`flex items-center justify-between p-3 rounded ${
                result.status === 'passed' ? 'bg-green-50' :
                result.status === 'failed' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <div className="flex items-center">
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    result.status === 'passed' ? 'bg-green-500' :
                    result.status === 'failed' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-sm font-medium text-gray-900">{result.checkType}</span>
                </div>
                <div className="flex items-center space-x-4">
                  {result.testSummary && (
                    <span className="text-xs text-gray-600">{result.testSummary}</span>
                  )}
                  <span className={`text-sm font-medium ${
                    result.status === 'passed' ? 'text-green-700' :
                    result.status === 'failed' ? 'text-red-700' :
                    'text-gray-600'
                  }`}>
                    {result.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex space-x-2">
              {!hasFailures && (
                <button
                  onClick={() => onApprove(run.promotionBlocked)}
                  disabled={run.status !== 'passed'}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve for Promotion
                </button>
              )}

              {hasFailures && (
                <>
                  <button
                    onClick={() => setShowRejectForm(!showRejectForm)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() => setShowRerunForm(!showRerunForm)}
                    disabled={!hasFailures}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Request Rerun
                  </button>
                </>
              )}
            </div>

            <Link
              href={`/generation-runs/${run.generationRunId}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View Generation Details →
            </Link>
          </div>

          {/* Reject Form */}
          {showRejectForm && (
            <div className="mt-4 p-4 bg-red-50 rounded">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Reason for rejection (required)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe why this generation should be rejected..."
                className="w-full px-3 py-2 border border-red-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                rows={3}
              />
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => {
                    if (rejectReason.trim()) {
                      onReject(rejectReason);
                      setShowRejectForm(false);
                      setRejectReason('');
                    }
                  }}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Submit Rejection
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rerun Form */}
          {showRerunForm && (
            <div className="mt-4 p-4 bg-blue-50 rounded">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Feedback for rerun (required)
              </label>
              <textarea
                value={rerunFeedback}
                onChange={(e) => setRerunFeedback(e.target.value)}
                placeholder="Describe what needs to be fixed or improved..."
                className="w-full px-3 py-2 border border-blue-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => {
                    if (rerunFeedback.trim()) {
                      onRerun(rerunFeedback);
                      setShowRerunForm(false);
                      setRerunFeedback('');
                    }
                  }}
                  disabled={!rerunFeedback.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Submit Rerun Request
                </button>
                <button
                  onClick={() => {
                    setShowRerunForm(false);
                    setRerunFeedback('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
