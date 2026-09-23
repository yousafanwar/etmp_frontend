import { useState } from "react";
import StatCard from "../../components/dashboard/StatCard";
import Icon from "../../components/common/Icon";
import "./Dashboard.css";

type Tone = "primary" | "error" | "tertiary";
type RiskTone = "error" | "secondary" | "tertiary";
type Priority = "P0" | "P1";

interface Milestone {
  project: string;
  dot: RiskTone;
  milestone: string;
  lead: string;
  due: string;
  risk: RiskTone;
  riskLabel: string;
}

interface UrgentAction {
  title: string;
  meta: string;
  priority: Priority;
}

interface WorkloadItem {
  team: string;
  pct: number;
  label: string;
  tone: Tone;
}

interface ActivityItem {
  initials: string;
  tone: "primary" | "error" | "neutral";
  badge: string;
  who: string;
  action: string;
  ref: string;
  refTone: "primary" | "error";
  time: string;
  team: string;
}

const milestones: Milestone[] = [
  { project: "Titan DB Sharding", dot: "error", milestone: "Phase 3 Multi-Region Partitioning", lead: "Marcus Vance", due: "Oct 24, 2024", risk: "error", riskLabel: "High Risk" },
  { project: "OAuth 2.1 FedRAMP", dot: "secondary", milestone: "SOC-2 Type II Scope Audit Sign-off", lead: "Siddharth Rao", due: "Nov 02, 2024", risk: "secondary", riskLabel: "Medium Risk" },
  { project: "Edge CDN Mesh", dot: "tertiary", milestone: "Tokyo & Frankfurt Edge Cache Rollout", lead: "Amina Chen", due: "Nov 15, 2024", risk: "tertiary", riskLabel: "On Track" },
  { project: "Mobile V3 Re-Platform", dot: "tertiary", milestone: "Core Engine Swift & Kotlin Migration", lead: "Lucas Meyer", due: "Nov 28, 2024", risk: "tertiary", riskLabel: "On Track" },
];

const urgentActions: UrgentAction[] = [
  { title: "Approve AWS Savings Plan Renewal", meta: "Finance Dept • Due Today, 5:00 PM", priority: "P0" },
  { title: "Authorize Security Patch Escalation", meta: "DevSecOps Pod • Due Today, 6:30 PM", priority: "P0" },
  { title: "Q4 Contractor SOW Final Signature", meta: "Legal & Talent • Due Tomorrow", priority: "P1" },
  { title: "Release Gateway Cutover Approval", meta: "Core Platform • Due Tomorrow", priority: "P1" },
];

const workload: WorkloadItem[] = [
  { team: "Product Design", pct: 92, label: "92%", tone: "primary" },
  { team: "Frontend Engineering", pct: 104, label: "104% (Overbooked)", tone: "error" },
  { team: "Backend & Platform", pct: 78, label: "78%", tone: "primary" },
  { team: "Quality Assurance", pct: 65, label: "65% (Available)", tone: "tertiary" },
];

const activity: ActivityItem[] = [
  { initials: "DV", tone: "primary", badge: "check", who: "Daria Vance", action: "closed pull request", ref: "#PR-882", refTone: "primary", time: "12m ago", team: "Infrastructure Pod" },
  { initials: "SL", tone: "error", badge: "priority_high", who: "Sarah Lin", action: "flagged dependency blocker on", ref: "SP-4190", refTone: "error", time: "1h ago", team: "Mobile Core" },
  { initials: "AM", tone: "neutral", badge: "bookmark", who: "Alex Mercer", action: "created new project milestone", ref: "SOC2-A3", refTone: "primary", time: "2h ago", team: "Governance & Trust" },
];

const UrgentItem = ({ title, meta, priority }: UrgentAction) => {
  const [done, setDone] = useState(false);

  return (
    <div className={`urgent-item ${done ? "is-done" : ""}`}>
      <div className="urgent-item-top">
        <label className="urgent-item-check">
          <input
            type="checkbox"
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
          />
          <div>
            <span className="urgent-item-title">{title}</span>
            <span className="urgent-item-meta">{meta}</span>
          </div>
        </label>
        <span className={`priority priority-${priority.toLowerCase()}`}>{priority}</span>
      </div>
      <div className="urgent-item-actions">
        <button type="button" className="btn-review">Review</button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <div className="dashboard">
      <section className="card dashboard-hero">
        <div className="hero-text">
          <h1>Overview</h1>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        </div>

        <div className="hero-controls">
          <button type="button" className="btn btn-subtle">
            <Icon name="calendar_today" size={18} />
            Last 30 Days
            <Icon name="expand_more" size={18} />
          </button>
          <button type="button" className="btn btn-subtle">
            <Icon name="domain" size={18} />
            All Teams
            <Icon name="expand_more" size={18} />
          </button>
          <button type="button" className="btn btn-primary">
            <Icon name="file_download" size={18} />
            Export Report
          </button>
        </div>
      </section>

      {/* KPI cards */}
      <section className="stats-grid">
        <StatCard
          title="Total Active Tasks"
          icon="assignment"
          value="1,428"
          badge="12.4%"
          badgeIcon="arrow_upward"
          footerLeft="+158 vs last sprint"
          footerRight="Healthy Velocity"
          footerRightTone="success"
        />
        <StatCard
          title="Overdue / Blocked"
          icon="warning"
          iconTone="error"
          value="14"
          valueTone="error"
          badge="3 Critical"
          badgeTone="error"
          footerLeft="Immediate resolution needed"
          footerRight="Triage queue"
          footerRightTone="error"
        />
        <StatCard
          title="Budget & Allocation"
          icon="account_balance_wallet"
          iconTone="tertiary"
          value="88%"
          statusText="On Track"
          statusTone="success"
          footerLeft="$142k uncommitted"
          footerRight="$1.2M cap"
        />
      </section>

      {/* Main grid */}
      <div className="main-grid">
        <section className="card milestones">
          <div className="card-header">
            <div>
              <h2>Critical Path &amp; At-Risk Milestones</h2>
              <p>Immediate executive tracking for core architectural and compliance dependencies</p>
            </div>
            <button type="button" className="link-btn">
              Full Roadmap
              <Icon name="arrow_forward" size={18} />
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Key Milestone</th>
                  <th>Assigned Lead</th>
                  <th>Due Date</th>
                  <th>Risk Status</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => (
                  <tr key={m.project}>
                    <td>
                      <div className="cell-project">
                        <span className={`dot dot-${m.dot}`} />
                        {m.project}
                      </div>
                    </td>
                    <td className="muted">{m.milestone}</td>
                    <td>
                      <div className="cell-lead">
                        <span className="avatar-sm">
                          {m.lead.split(" ").map((n) => n[0]).join("")}
                        </span>
                        {m.lead}
                      </div>
                    </td>
                    <td className="muted num">{m.due}</td>
                    <td>
                      <span className={`risk-pill risk-${m.risk}`}>
                        <span className={`dot dot-sm dot-${m.risk}`} />
                        {m.riskLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="side-column">
          <section className="card urgent">
            <div className="card-header">
              <div className="urgent-heading">
                <Icon name="bolt" className="text-error" />
                <h2>Urgent Actions</h2>
              </div>
              <span className="count-pill">{urgentActions.length} Awaiting</span>
            </div>
            <div className="urgent-list">
              {urgentActions.map((a) => (
                <UrgentItem key={a.title} {...a} />
              ))}
            </div>
          </section>

          <section className="card workload">
            <div className="card-header">
              <h2>Team Workload</h2>
              <span className="workload-caption">Sprint Capacity</span>
            </div>
            <div className="workload-list">
              {workload.map((w) => (
                <div key={w.team} className="workload-row">
                  <div className="workload-labels">
                    <span className="workload-team">{w.team}</span>
                    <span className={`workload-value tone-text-${w.tone}`}>{w.label}</span>
                  </div>
                  <div className="progress">
                    <div
                      className={`progress-fill fill-${w.tone}`}
                      style={{ width: `${Math.min(w.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="callout">
              <Icon name="info" size={18} className="text-primary" />
              <span>Recommend shifting 3 front-end issues to Sprint 36.</span>
            </div>
          </section>
        </div>
      </div>

      {/* Activity stream */}
      <section className="card activity">
        <div className="card-header">
          <div>
            <h2>Operational Activity Stream</h2>
            <p>Live audit events, merges, and state changes across all tracked repositories</p>
          </div>
          <button type="button" className="link-btn link-btn-caps">
            View Full Audit Log
          </button>
        </div>

        <div className="activity-grid">
          {activity.map((a) => (
            <div key={a.ref} className="activity-item">
              <div className="activity-avatar-wrap">
                <div className={`activity-avatar avatar-${a.tone}`}>{a.initials}</div>
                <Icon name={a.badge} size={12} className={`activity-badge badge-${a.tone}`} />
              </div>
              <div className="activity-body">
                <p>
                  <strong>{a.who}</strong> {a.action}{" "}
                  <code className={`ref ref-${a.refTone}`}>{a.ref}</code>
                </p>
                <span className="activity-meta">
                  {a.time} • {a.team}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;