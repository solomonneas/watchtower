"""Configuration loader for Watchtower."""

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel
from pydantic_settings import BaseSettings


class AuthConfig(BaseModel):
    admin_user: str = "admin"
    admin_password_hash: str = ""
    jwt_secret: str = "change-me-in-production"
    session_hours: int = 24


class LibreNMSConfig(BaseModel):
    url: str = ""
    api_key: str = ""
    webhook_token: str = ""


class NetdiscoConfig(BaseModel):
    url: str = ""
    api_key: str = ""
    username: str = ""
    password: str = ""


class ProxmoxConfig(BaseModel):
    url: str = ""
    token_id: str = ""
    token_secret: str = ""
    verify_ssl: bool = False


class DataSourcesConfig(BaseModel):
    librenms: LibreNMSConfig = LibreNMSConfig()
    netdisco: NetdiscoConfig = NetdiscoConfig()
    proxmox: ProxmoxConfig = ProxmoxConfig()


class PollingConfig(BaseModel):
    device_status: int = 30
    device_stats: int = 60
    topology: int = 300
    interfaces: int = 60
    proxmox: int = 60


class DiscordConfig(BaseModel):
    enabled: bool = False
    webhook_url: str = ""
    mention_role: str = "@here"


class PushoverConfig(BaseModel):
    enabled: bool = False
    user_key: str = ""
    app_token: str = ""
    priority: int = 2
    retry: int = 30
    expire: int = 300


class NotificationChannels(BaseModel):
    discord: DiscordConfig = DiscordConfig()
    pushover: PushoverConfig = PushoverConfig()


class NotificationsConfig(BaseModel):
    notify_on: list[str] = ["critical"]
    notify_on_recovery: bool = True
    cooldown_minutes: int = 5
    channels: NotificationChannels = NotificationChannels()


class AlertThresholds(BaseModel):
    cpu_warning: int = 80
    cpu_critical: int = 95
    memory_warning: int = 85
    memory_critical: int = 95
    interface_utilization_warning: int = 70
    interface_utilization_critical: int = 90


class AlertThresholdsConfig(BaseModel):
    defaults: AlertThresholds = AlertThresholds()
    overrides: dict[str, AlertThresholds] = {}


class AppConfig(BaseModel):
    auth: AuthConfig = AuthConfig()
    data_sources: DataSourcesConfig = DataSourcesConfig()
    polling: PollingConfig = PollingConfig()
    notifications: NotificationsConfig = NotificationsConfig()
    alert_thresholds: AlertThresholdsConfig = AlertThresholdsConfig()


class Settings(BaseSettings):
    """Environment-based settings."""

    redis_url: str = "redis://localhost:6379"
    dev_mode: bool = True
    config_path: str = "../config/config.yaml"
    topology_path: str = "../config/topology.yaml"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def load_yaml_config(path: str) -> dict[str, Any]:
    """Load a YAML configuration file."""
    config_path = Path(path)
    if not config_path.is_absolute():
        config_path = Path(__file__).parent.parent / path

    if not config_path.exists():
        return {}

    with open(config_path) as f:
        return yaml.safe_load(f) or {}


def get_config() -> AppConfig:
    """Load and return the application configuration."""
    settings = Settings()
    yaml_config = load_yaml_config(settings.config_path)
    return AppConfig(**yaml_config)


def get_topology_config() -> dict[str, Any]:
    """Load and return the topology configuration."""
    settings = Settings()
    return load_yaml_config(settings.topology_path)


# Singleton instances
settings = Settings()
config = get_config()


class IntegrationSettings:
    """Convenience class for integration clients to access config."""

    def __init__(self):
        self._config = get_config()

    @property
    def librenms_url(self) -> str:
        return self._config.data_sources.librenms.url

    @property
    def librenms_api_key(self) -> str:
        return self._config.data_sources.librenms.api_key

    @property
    def netdisco_url(self) -> str:
        return self._config.data_sources.netdisco.url

    @property
    def netdisco_api_key(self) -> str:
        return self._config.data_sources.netdisco.api_key

    @property
    def netdisco_username(self) -> str:
        return self._config.data_sources.netdisco.username

    @property
    def netdisco_password(self) -> str:
        return self._config.data_sources.netdisco.password

    @property
    def proxmox_url(self) -> str:
        return self._config.data_sources.proxmox.url

    @property
    def proxmox_token_id(self) -> str:
        return self._config.data_sources.proxmox.token_id

    @property
    def proxmox_token_secret(self) -> str:
        return self._config.data_sources.proxmox.token_secret

    @property
    def proxmox_verify_ssl(self) -> bool:
        return self._config.data_sources.proxmox.verify_ssl


def get_settings() -> IntegrationSettings:
    """Get integration settings for API clients."""
    return IntegrationSettings()
