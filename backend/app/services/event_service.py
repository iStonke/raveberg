from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from app.schemas.display import DisplayStatusRead
from app.schemas.mode import ModeRead
from app.schemas.runtime import CleanupCompletedEvent, RateLimitTriggeredEvent, SelfiePlaybackEvent
from app.schemas.selfie import SelfieStateRead
from app.schemas.standby import StandbyStateRead
from app.schemas.upload import UploadDeletedEvent, UploadEvent
from app.schemas.video import VideoAssetRead, VideoStateRead
from app.schemas.visualizer import VisualizerStateRead


class EventService:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()

    async def publish(self, event_name: str, payload: dict | list[dict]) -> None:
        message = self._format_event(event_name, payload)
        for queue in list(self._subscribers):
            await queue.put(message)

    async def publish_mode(self, payload: ModeRead) -> None:
        await self.publish("mode_changed", payload.model_dump(mode="json"))

    async def publish_blackout_activated(self, payload: ModeRead) -> None:
        await self.publish("blackout_activated", payload.model_dump(mode="json"))

    async def publish_blackout_cleared(self, payload: ModeRead) -> None:
        await self.publish("blackout_cleared", payload.model_dump(mode="json"))

    async def publish_upload(self, payload: UploadEvent) -> None:
        await self.publish("upload_created", payload.model_dump(mode="json"))

    async def publish_upload_approved(self, payload: UploadEvent) -> None:
        await self.publish("upload_approved", payload.model_dump(mode="json"))

    async def publish_upload_rejected(self, payload: UploadEvent) -> None:
        await self.publish("upload_rejected", payload.model_dump(mode="json"))

    async def publish_upload_deleted(self, payload: UploadDeletedEvent) -> None:
        await self.publish("upload_deleted", payload.model_dump(mode="json"))

    async def publish_cleanup_completed(self, payload: CleanupCompletedEvent) -> None:
        await self.publish("cleanup_completed", payload.model_dump(mode="json"))

    async def publish_rate_limit_triggered(self, payload: RateLimitTriggeredEvent) -> None:
        await self.publish("rate_limit_triggered", payload.model_dump(mode="json"))

    async def publish_visualizer(self, payload: VisualizerStateRead) -> None:
        await self.publish("visualizer_updated", payload.model_dump(mode="json"))

    async def publish_visualizer_preset_changed(self, payload: VisualizerStateRead) -> None:
        await self.publish("visualizer_preset_changed", payload.model_dump(mode="json"))

    async def publish_visualizer_auto_cycle(self, payload: VisualizerStateRead) -> None:
        await self.publish("visualizer_auto_cycle_updated", payload.model_dump(mode="json"))

    async def publish_selfie_settings(self, payload: SelfieStateRead) -> None:
        await self.publish("selfie_settings_updated", payload.model_dump(mode="json"))

    async def publish_standby_settings(self, payload: StandbyStateRead) -> None:
        await self.publish("standby_settings_updated", payload.model_dump(mode="json"))

    async def publish_selfie_playback(self, payload: SelfiePlaybackEvent) -> None:
        await self.publish("selfie_playback_updated", payload.model_dump(mode="json"))

    async def publish_video_settings(self, payload: VideoStateRead) -> None:
        await self.publish("video_settings_updated", payload.model_dump(mode="json"))

    async def publish_video_library(self, payload: list[VideoAssetRead]) -> None:
        await self.publish(
            "video_library_updated",
            [asset.model_dump(mode="json") for asset in payload],
        )

    async def publish_heartbeat_updated(self, payload: DisplayStatusRead) -> None:
        await self.publish("heartbeat_updated", payload.model_dump(mode="json"))

    async def stream(self, initial_events: list[tuple[str, dict]]) -> AsyncIterator[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers.add(queue)

        try:
            for event_name, payload in initial_events:
                yield self._format_event(event_name, payload)
            while True:
                yield await queue.get()
        finally:
            self._subscribers.discard(queue)

    @staticmethod
    def _format_event(event_name: str, payload: dict | list[dict]) -> str:
        return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"


event_service = EventService()
