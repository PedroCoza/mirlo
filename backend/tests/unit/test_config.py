"""Pruebas del endpoint de configuracion del sistema."""
import pytest

pytestmark = [pytest.mark.unit, pytest.mark.config]


def test_config_basica(client, perfil):
    resp = client.get(f"/config?perfil_id={perfil['id']}")

    assert resp.status_code == 200
    cuerpo = resp.json()
    assert "gpu_disponible" in cuerpo
    assert "gpu_nombre" in cuerpo
    assert cuerpo["recomendado"]["modelo"] == "base"
    assert cuerpo["actual"]["modelo"] == "base"
    assert cuerpo["actual"]["hf_token_configurado"] is False


def test_actualizar_config(client, perfil):
    resp = client.put(
        f"/config/{perfil['id']}",
        json={"modelo": "small", "compute_type": "float16", "batch_size": 4},
    )
    assert resp.status_code == 200

    cuerpo = client.get(f"/config?perfil_id={perfil['id']}").json()
    assert cuerpo["actual"] == {
        "modelo": "small",
        "compute_type": "float16",
        "batch_size": 4,
        "hf_token_configurado": False,
    }


def test_guardar_token_hf(client, perfil):
    resp = client.put(
        f"/config/{perfil['id']}",
        json={
            "modelo": "base",
            "compute_type": "int8",
            "batch_size": 8,
            "hf_token": "hf-token-fake",
        },
    )
    assert resp.status_code == 200

    actual = client.get(f"/config?perfil_id={perfil['id']}").json()["actual"]
    assert actual["hf_token_configurado"] is True


def test_perfil_inexistente(client):
    inexistente = "00000000-0000-0000-0000-000000000000"

    resp_get = client.get(f"/config?perfil_id={inexistente}")
    resp_put = client.put(
        f"/config/{inexistente}",
        json={"modelo": "base", "compute_type": "int8", "batch_size": 8},
    )

    assert resp_get.status_code == 404
    assert resp_put.status_code == 404
