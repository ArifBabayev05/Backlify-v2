const { v4: uuidv4 } = require('uuid');

class APIPublisher {
  constructor() {
    this.apiInstances = new Map();
  }

  publishAPI(router) {
    const apiId = uuidv4();
    this.apiInstances.set(apiId, router);
    return apiId;
  }

  getRouter(apiId) {
    return this.apiInstances.get(apiId);
  }

  unpublishAPI(apiId) {
    return this.apiInstances.delete(apiId);
  }
}

module.exports = new APIPublisher(); 