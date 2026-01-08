import importlib
import pkgutil

from fastapi import APIRouter

router = APIRouter(prefix="/api")

package = __name__  # app.api.routes

for _, module_name, _ in pkgutil.iter_modules(__path__):  # type: ignore[assignment]
    module = importlib.import_module(f"{package}.{module_name}")
    if hasattr(module, "router"):
        subrouter = module.router
        router.include_router(
            subrouter, prefix=f"/{module_name.replace('_', '-')}", tags=[module_name]
        )
