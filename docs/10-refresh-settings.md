# Refresh settings

Arrival polling defaults to 30 seconds. Users can choose only 15, 30, 45 or 60 seconds in the settings dialog. The value is stored in the versioned local-storage state; invalid or legacy values are sanitized back to the 30-second default.

The timer is paused while the tab is hidden and resumes when it becomes visible. Manual refresh remains available independently of the polling setting.
