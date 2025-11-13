"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TutorCruncherClient = void 0;
const axios_1 = __importDefault(require("axios"));
const branch_utils_1 = require("../utils/branch-utils");
const tc_resource_type_enums_1 = require("../enums/tc-resource-type.enums");
class TutorCruncherClient {
    constructor(branchId) {
        this.baseUrl = "https://secure.tutorcruncher.com/api";
        this.token = branch_utils_1.BranchUtils.getBranchToken(branchId);
        if (!this.token) {
            throw new Error(`No token found for branch ID: ${branchId}`);
        }
    }
    async apiRequest(endpoint, method = "GET", body = null, params = {}) {
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
            const response = await (0, axios_1.default)(config);
            return response.data;
        }
        catch (error) {
            console.error(`TutorCruncher API Error: ${error.message}`, error);
            throw error;
        }
    }
    async getResourceById(resourceType, id) {
        return this.apiRequest(`/${resourceType}/${id}`, "GET");
    }
    async getAllResources(resourceType, params = {}) {
        return this.apiRequest(`/${resourceType}/`, "GET", null, params);
    }
    async createResource(resourceType, data) {
        return this.apiRequest(`/${resourceType}/`, "POST", data);
    }
    async updateResource(resourceType, data, id) {
        const usePostForUpdate = [
            tc_resource_type_enums_1.ResourceType.CLIENTS,
            tc_resource_type_enums_1.ResourceType.CONTRACTORS,
            tc_resource_type_enums_1.ResourceType.RECIPIENTS,
        ];
        const method = usePostForUpdate.includes(resourceType) ? "POST" : "PUT";
        const endpoint = method === "POST" ? `/${resourceType}/` : `/${resourceType}/${id}`;
        return this.apiRequest(endpoint, method, data);
    }
    async deleteResource(resourceType, id) {
        return this.apiRequest(`/${resourceType}/${id}`, "DELETE");
    }
    async addLabelToClient(clientId, labelId) {
        try {
            console.log(`🏷️ Adding label ${labelId} to client ${clientId}`);
            const endpoint = `/clients/${clientId}/add_label/`;
            const result = await this.apiRequest(endpoint, "POST", {
                label: labelId,
            });
            console.log(`✅ Successfully added label to client ${clientId}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Error adding label to client:`, error);
            throw error;
        }
    }
    async removeLabelFromClient(clientId, labelId) {
        try {
            console.log(`🏷️ Removing label ${labelId} from client ${clientId}`);
            const endpoint = `/clients/${clientId}/remove_label/`;
            const result = await this.apiRequest(endpoint, "POST", {
                label: labelId,
            });
            console.log(`✅ Successfully removed label from client ${clientId}`);
            return result;
        }
        catch (error) {
            console.error(`❌ Error removing label from client:`, error);
            throw error;
        }
    }
}
exports.TutorCruncherClient = TutorCruncherClient;
