// services/api/org.ts
import { fetchJSON } from "./base";
import type { Org, GetOrgParams  } from "@/types";


/** GET /api/orgs/{id} */
export async function getOrg(params: GetOrgParams = {}) : Promise<Org> {
  return fetchJSON<Org>(`/org/${params.id?params.id : ""}`);
}

