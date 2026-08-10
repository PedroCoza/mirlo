import pytest

pytestmark = [pytest.mark.unit, pytest.mark.perfiles]


def test_crear(client, perfil_datos):
    resp = client.post("/perfiles", json=perfil_datos)
    assert resp.status_code == 201
    cuerpo = resp.json()
    assert cuerpo["nombre"] == perfil_datos["nombre"]
    assert cuerpo["avatar"] == perfil_datos["avatar"]
    assert "id" in cuerpo
    assert "creado_en" in cuerpo


def test_avatar_default(client):
    resp = client.post("/perfiles", json={"nombre": "Sin Avatar"})
    assert resp.status_code == 201
    assert resp.json()["avatar"] == "🐣"


def test_editar(client, perfil):
    perfil_id = perfil["id"]
    resp = client.put(
        f"/perfiles/{perfil_id}",
        json={"nombre": "Editado", "avatar": "🐱"},
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["nombre"] == "Editado"
    assert cuerpo["avatar"] == "🐱"
    assert cuerpo["id"] == perfil_id


def test_editar_404(client):
    resp = client.put(
        "/perfiles/00000000-0000-0000-0000-000000000000",
        json={"nombre": "Nadie", "avatar": "❓"},
    )
    assert resp.status_code == 404


def test_eliminar(client, perfil):
    perfil_id = perfil["id"]
    resp = client.delete(f"/perfiles/{perfil_id}")
    assert resp.status_code == 204
    listado = client.get("/perfiles").json()
    assert all(p["id"] != perfil_id for p in listado)


def test_eliminar_404(client):
    resp = client.delete("/perfiles/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_listar_orden(client):
    nombres = ["Primero", "Segundo", "Tercero"]
    for nombre in nombres:
        resp = client.post("/perfiles", json={"nombre": nombre})
        assert resp.status_code == 201

    listado = client.get("/perfiles").json()
    nombres_listados = [p["nombre"] for p in listado]
    for nombre in nombres:
        assert nombre in nombres_listados

    posiciones = [nombres_listados.index(n) for n in nombres]
    assert posiciones == sorted(posiciones)


def test_crear_sin_nombre(client):
    resp = client.post("/perfiles", json={"avatar": "🦊"})
    assert resp.status_code == 422


def test_crear_tipo_invalido(client):
    resp = client.post("/perfiles", json={"nombre": 123, "avatar": "🦊"})
    assert resp.status_code == 422


def test_listar_vacio(client):
    resp = client.get("/perfiles")
    assert resp.status_code == 200
    assert resp.json() == []
