"""Utilities for interacting with MCPO-hosted MCP servers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class MCPOResult:
    """Normalized representation of a result returned by an MCPO tool."""

    title: str
    description: str
    content: str
    metadata: dict[str, Any]
    url: str | None = None


class MCPOConnector:
    """Client wrapper for invoking tools exposed through an MCPO deployment."""

    def __init__(
        self,
        base_url: str,
        server: str,
        tool: str | None = None,
        *,
        api_key: str | None = None,
        query_param: str | None = "query",
        static_args: dict[str, Any] | None = None,
        result_path: str | None = None,
        timeout: float | None = 30.0,
        openapi_url: str | None = None,
    ) -> None:
        if not base_url:
            raise ValueError("MCPO base URL cannot be empty")
        if not server:
            raise ValueError("MCPO server identifier cannot be empty")

        self.base_url = base_url.rstrip("/")
        self.server = server.strip("/")
        self.tool = tool.strip("/") if tool else None
        self.api_key = api_key.strip() if api_key else None
        self.query_param = query_param.strip() if query_param else None
        self.static_args = static_args or {}
        self.result_path_tokens = [
            token.strip() for token in result_path.split(".") if token.strip()
        ] if result_path else []
        self.timeout = timeout
        if openapi_url:
            candidate = openapi_url.strip()
            self.openapi_url = candidate if candidate else None
        else:
            self.openapi_url = (
                f"{self.base_url}/{self.server}/openapi.json"
                if self.base_url and self.server
                else None
            )

    async def search(self, query: str) -> list[MCPOResult]:
        """Invoke the configured MCPO tool with the provided query string."""

        payload: dict[str, Any] = {}
        if self.static_args:
            payload.update(self.static_args)
        if self.query_param:
            payload[self.query_param] = query

        response_data = await self._post(payload)
        normalized_payload = self._extract_result_container(response_data)
        results: list[MCPOResult] = []

        if isinstance(normalized_payload, list):
            for index, item in enumerate(normalized_payload, start=1):
                results.append(self._normalize_item(item, index))
        elif normalized_payload is not None:
            results.append(self._normalize_item(normalized_payload, 1))

        return results

    async def _post(self, payload: dict[str, Any]) -> Any:
        if not self.tool:
            raise ValueError("MCPO tool name has not been configured")

        url = f"{self.base_url}/{self.server}/{self.tool}"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        timeout = httpx.Timeout(self.timeout or 30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "").lower()
            if "application/json" in content_type:
                return response.json()
            try:
                return response.json()
            except ValueError:
                return response.text

    def _extract_result_container(self, data: Any) -> Any:
        """Extract the list of results based on configuration heuristics."""

        current = data
        for token in self.result_path_tokens:
            if isinstance(current, dict):
                current = current.get(token)
            elif isinstance(current, list) and token.isdigit():
                index = int(token)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            else:
                return None

        if isinstance(current, dict):
            for key in ("results", "items", "data", "documents"):
                value = current.get(key)
                if isinstance(value, list):
                    return value
        return current

    def with_tool(self, tool: str) -> MCPOConnector:
        """Return a new connector instance configured for the given tool."""

        return MCPOConnector(
            base_url=self.base_url,
            server=self.server,
            tool=tool,
            api_key=self.api_key,
            query_param=self.query_param,
            static_args=self.static_args,
            result_path=".".join(self.result_path_tokens) if self.result_path_tokens else None,
            timeout=self.timeout,
            openapi_url=self.openapi_url,
        )

    async def list_tools(self) -> list[str]:
        """Discover available tools by inspecting the MCPO OpenAPI schema."""

        if not self.openapi_url:
            raise ValueError("MCPO OpenAPI URL is not configured")

        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        timeout = httpx.Timeout(self.timeout or 30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(self.openapi_url, headers=headers)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "").lower()
            try:
                if "application/json" in content_type:
                    data: Any = response.json()
                else:
                    data = response.json()
            except ValueError as exc:
                raise ValueError("MCPO OpenAPI endpoint did not return valid JSON") from exc

        return self._extract_tools_from_openapi(data)

    def _extract_tools_from_openapi(self, payload: Any) -> list[str]:
        """Parse an OpenAPI schema and return discovered tool names."""

        if not isinstance(payload, dict):
            return []

        paths = payload.get("paths")
        if not isinstance(paths, dict):
            return []

        tools: list[str] = []
        server_prefix = self.server.strip("/")

        for raw_path, operations in paths.items():
            if not isinstance(raw_path, str) or not isinstance(operations, dict):
                continue

            segments = [
                segment
                for segment in raw_path.strip("/").split("/")
                if segment and not segment.startswith("{")
            ]
            if not segments:
                continue

            if server_prefix and segments[0] != server_prefix:
                continue

            if not any(method.lower() == "post" for method in operations):
                continue

            if server_prefix:
                if len(segments) < 2:
                    continue
                candidate = segments[-1]
            else:
                candidate = segments[-1]

            if candidate and candidate not in tools:
                tools.append(candidate)

        return tools

    @classmethod
    async def discover_tools(
        cls,
        *,
        base_url: str,
        server: str,
        api_key: str | None = None,
        openapi_url: str | None = None,
        timeout: float | None = 30.0,
    ) -> list[str]:
        """Helper to discover MCPO tool names without pre-configuring a tool."""

        connector = cls(
            base_url=base_url,
            server=server,
            tool=None,
            api_key=api_key,
            timeout=timeout,
            openapi_url=openapi_url,
        )

        return await connector.list_tools()

    def _normalize_item(self, item: Any, position: int) -> MCPOResult:
        """Convert a raw MCPO payload into a standardized result object."""

        title = f"MCPO Result {position}"
        description = ""
        content = ""
        metadata: dict[str, Any] = {}
        url: str | None = None

        if isinstance(item, dict):
            metadata = item
            title = (
                str(
                    item.get("title")
                    or item.get("name")
                    or item.get("id")
                    or title
                )
            )
            url_value = item.get("url") or item.get("link")
            if isinstance(url_value, str):
                url = url_value

            description_value = (
                item.get("description")
                or item.get("summary")
                or item.get("snippet")
            )
            if isinstance(description_value, str):
                description = description_value

            content_value = item.get("content")
            if content_value is None:
                content = json.dumps(item, ensure_ascii=False, indent=2)
            else:
                content = self._stringify(content_value)
        elif isinstance(item, str):
            content = item
        else:
            content = self._stringify(item)

        if not description and content:
            description = content[:200]

        return MCPOResult(
            title=title,
            description=description,
            content=content,
            metadata=metadata if isinstance(metadata, dict) else {"value": metadata},
            url=url,
        )

    @staticmethod
    def _stringify(value: Any) -> str:
        if isinstance(value, str):
            return value
        try:
            if isinstance(value, dict | list):
                return json.dumps(value, ensure_ascii=False, indent=2)
            return json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(value)
