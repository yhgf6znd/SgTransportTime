# Refresh settings

Arrival polling defaults to 30 seconds. Users can choose only 15, 30, 45 or 60 seconds in the settings dialog. The value is stored in the versioned local-storage state; invalid or legacy values are sanitized back to the 30-second default.

The timer is paused while the tab is hidden and resumes when it becomes visible. Manual refresh remains available independently of the polling setting.

Bus polling replaces only the arrival-card container, preserving the stop heading and surrounding page controls. MRT/LRT arrivals are scheduled baseline data, so the timer polls only `/api/train/alerts`; the alert notice is updated when the disruption payload changes, while scheduled arrival cards remain mounted.
