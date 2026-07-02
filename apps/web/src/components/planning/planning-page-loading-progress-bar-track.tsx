type Props = {
  ariaLabel: string;
};

export function PlanningPageLoadingProgressBarTrack({ ariaLabel }: Props) {
  return (
    <div
      className="planning-content-loading-progress-track"
      role="progressbar"
      aria-label={ariaLabel}
    >
      <div className="planning-content-loading-progress-bar" />
    </div>
  );
}
