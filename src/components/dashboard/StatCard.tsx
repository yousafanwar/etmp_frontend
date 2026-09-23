import Icon from "../common/Icon";

interface StatCardProps {
  title: string;
  icon: string;
  iconTone?: "primary" | "error" | "tertiary";
  value: string | number;
  valueTone?: "default" | "error";
  badge?: string;
  badgeTone?: "success" | "error";
  badgeIcon?: string;
  statusText?: string;
  statusTone?: "success";
  footerLeft: string;
  footerRight: string;
  footerRightTone?: "default" | "success" | "error";
}

const StatCard = ({
  title,
  icon,
  iconTone = "primary",
  value,
  valueTone = "default",
  badge,
  badgeTone = "success",
  badgeIcon,
  statusText,
  statusTone,
  footerLeft,
  footerRight,
  footerRightTone = "default",
}: StatCardProps) => (
  <div className="stat-card">
    <div className="stat-card-top">
      <span className="stat-card-title">{title}</span>
      <span className={`stat-card-icon tone-${iconTone}`}>
        <Icon name={icon} />
      </span>
    </div>

    <div className="stat-card-main">
      <span className={`stat-card-value ${valueTone === "error" ? "is-error" : ""}`}>
        {value}
      </span>
      {badge && (
        <span className={`stat-badge badge-${badgeTone}`}>
          {badgeIcon && <Icon name={badgeIcon} size={14} />}
          {badge}
        </span>
      )}
      {statusText && (
        <span className={`stat-status status-${statusTone}`}>{statusText}</span>
      )}
    </div>

    <div className="stat-card-footer">
      <span>{footerLeft}</span>
      <span className={`stat-footer-right footer-${footerRightTone}`}>{footerRight}</span>
    </div>
  </div>
);

export default StatCard;