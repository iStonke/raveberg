from __future__ import annotations

from collections import defaultdict, deque
from collections.abc import Callable
from datetime import datetime, timezone
from threading import Lock

from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.runtime import CleanupCompletedEvent, RateLimitTriggeredEvent, SelfiePlaybackEvent


class RuntimeService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._upload_windows: dict[str, deque[datetime]] = defaultdict(deque)
        self._last_rate_limit_at: datetime | None = None
        self._rate_limit_trigger_count = 0
        self._last_cleanup_at: datetime | None = None
        self._last_cleanup_removed = 0
        self._selfie_sequence = 0

    def enforce_upload_rate_limit(
        self,
        ip_address: str,
        publish_callback: Callable[[RateLimitTriggeredEvent], None] | None = None,
    ) -> None:
        now = datetime.now(timezone.utc)
        window_seconds = settings.upload_rate_limit_window_seconds
        max_requests = settings.upload_rate_limit_count

        with self._lock:
            bucket = self._upload_windows[ip_address]
            while bucket and (now - bucket[0]).total_seconds() >= window_seconds:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after = max(1, window_seconds - int((now - bucket[0]).total_seconds()))
                self._last_rate_limit_at = now
                self._rate_limit_trigger_count += 1
                event = RateLimitTriggeredEvent(
                    ip_address=ip_address,
                    retry_after_seconds=retry_after,
                    triggered_at=now,
                )
                if publish_callback is not None:
                    publish_callback(event)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Zu viele Uploads. Bitte in {retry_after}s erneut versuchen.",
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)

    def record_cleanup(self, removed_ids: list[int]) -> CleanupCompletedEvent:
        event = CleanupCompletedEvent(
            removed_ids=removed_ids,
            removed_count=len(removed_ids),
            completed_at=datetime.now(timezone.utc),
        )
        with self._lock:
            self._last_cleanup_at = event.completed_at
            self._last_cleanup_removed = event.removed_count
        return event

    def issue_selfie_action(self, action: str) -> SelfiePlaybackEvent:
        with self._lock:
            self._selfie_sequence += 1
            sequence = self._selfie_sequence
        return SelfiePlaybackEvent(
            action=action,
            sequence=sequence,
            issued_at=datetime.now(timezone.utc),
        )

    def diagnostics(self) -> dict[str, datetime | int | None]:
        with self._lock:
            return {
                "last_rate_limit_at": self._last_rate_limit_at,
                "rate_limit_trigger_count": self._rate_limit_trigger_count,
                "last_cleanup_at": self._last_cleanup_at,
                "last_cleanup_removed": self._last_cleanup_removed,
            }


runtime_service = RuntimeService()
