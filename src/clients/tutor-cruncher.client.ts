import axios from "axios";
import { BranchUtils } from "../utils/branch-utils";
import { ResourceType } from "../enums/tc-resource-type.enums";


export interface TCAppointment {
  id: number;
  start: string;
  finish: string;
  topic: string;
  status: string;
  url: string;
  service: {
    id: number;
    name: string;
  };
}

export interface TCResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TCAppointment[];
}


export class TutorCruncherClient {
  private baseUrl: string;
  private token: string | null;

  constructor(branchId: string | number) {
    this.baseUrl = "https://secure.tutorcruncher.com/api";
    this.token = BranchUtils.getBranchToken(branchId);

    if (!this.token) {
      throw new Error(`No token found for branch ID: ${branchId}`);
    }
  }

  async apiRequest(
    endpoint: string,
    method: string = "GET",
    body: any = null,
    params: any = {}
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const config = {
        method,
        url,
        headers: {
          Authorization: `token ${this.token}`,
          "Content-Type": "application/json",
        },
        params,
        data: body ? body : undefined,
      };

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      console.error(`TutorCruncher API Error: ${error.message}`, error);
      throw error;
    }
  }

  async getResourceById(resourceType: ResourceType, id: string): Promise<any> {
    return this.apiRequest(`/${resourceType}/${id}`, "GET");
  }

  async getAllResources(
    resourceType: ResourceType,
    params: any = {}
  ): Promise<any> {
    return this.apiRequest(`/${resourceType}/`, "GET", null, params);
  }

  async createResource(resourceType: ResourceType, data: any): Promise<any> {
    return this.apiRequest(`/${resourceType}/`, "POST", data);
  }

  async updateResource(
    resourceType: ResourceType,
    data: any,
    id?: string
  ): Promise<any> {
    const usePostForUpdate = [
      ResourceType.CLIENTS,
      ResourceType.CONTRACTORS,
      ResourceType.RECIPIENTS,
    ];

    const method = usePostForUpdate.includes(resourceType) ? "POST" : "PUT";

    const endpoint =
      method === "POST" ? `/${resourceType}/` : `/${resourceType}/${id}`;

    return this.apiRequest(endpoint, method, data);
  }

  async deleteResource(resourceType: ResourceType, id: string): Promise<any> {
    return this.apiRequest(`/${resourceType}/${id}`, "DELETE");
  }

  async addLabelToClient(
    clientId: string,
    labelId: string | number
  ): Promise<any> {
    try {
      console.log(`🏷️ Adding label ${labelId} to client ${clientId}`);

      const endpoint = `/clients/${clientId}/add_label/`;
      const result = await this.apiRequest(endpoint, "POST", {
        label: labelId,
      });

      console.log(`✅ Successfully added label to client ${clientId}`);
      return result;
    } catch (error) {
      console.error(`❌ Error adding label to client:`, error);
      throw error;
    }
  }

  async removeLabelFromClient(
    clientId: string | number,
    labelId: string | number
  ): Promise<any> {
    try {
      console.log(`🏷️ Removing label ${labelId} from client ${clientId}`);

      const endpoint = `/clients/${clientId}/remove_label/`;
      const result = await this.apiRequest(endpoint, "POST", {
        label: labelId,
      });

      console.log(`✅ Successfully removed label from client ${clientId}`);
      return result;
    } catch (error) {
      console.error(`❌ Error removing label from client:`, error);
      throw error;
    }
  }


  /**
   * 🔍 Récupère la liste des URLs des appointments filtrées par statut planned.
   *
   * @param jobId service id
   */
  public async getAppointmentUrls(jobId: number): Promise<string[]> {
    const collectedUrls: string[] = [];
    let nextPageUrl: string | null = `${this.baseUrl}/appointments/?service=${jobId}`;

    const allowedStatus = "planned";

    // Helper : convert API URL → UI URL
    const apiToUi = (apiUrl: string): string | null => {
      const match = apiUrl.match(/\/appointments\/(\d+)\/?$/);
      if (!match) return null;

      const id = match[1];
      const baseUi = process.env.TC_UI_BASE_URL || "https://app.tutorax.com";
      return `${baseUi.replace(/\/$/, "")}/cal/appointments/${id}/`;
    };

    try {
      while (nextPageUrl) {
        const response: import("axios").AxiosResponse<TCResponse> =
            await axios.get<TCResponse>(nextPageUrl, {
              headers: {
                Authorization: `token ${this.token}`,
                "Content-Type": "application/json",
              },
            });

        const data: TCResponse = response.data;

        // Vérifie si résultats présents
        if (Array.isArray(data.results)) {
          const pending = data.results.filter(
              (appt: TCAppointment) =>
                  appt.status.toLowerCase() == allowedStatus
          );

          const urls = pending
              .map((appt: TCAppointment) =>
                  appt.url ? apiToUi(appt.url) : null
              )
              .filter((u: string | null): u is string => Boolean(u));

          collectedUrls.push(...urls);
        }

        nextPageUrl = data.next;
      }

      return collectedUrls;
    } catch (err: any) {
      console.error("❌ Error fetching appointment URLs:", err?.message || err);
      throw err;
    }
  }


}
