

To trigger and update

```sh
docker exec -it grove /bin/bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

make sure you can edit the revision after creating it
`chown 1000:1000 XX`