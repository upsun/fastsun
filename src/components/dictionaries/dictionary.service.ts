import APIService from '../base/api';
import type { DictionaryEntity, DictionaryItemEntity } from './dictionary.interface';

export type APIResponse = [null, null] | [Error];

export default class DictionaryAPIService extends APIService {
  constructor(service_id: string, token: string) {
    super(service_id, token);
  }

  /**
   * Get all dictionaries for a specific version
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary/
   * GET /service/{service_id}/version/{version_id}/dictionary
   */
  async getDictionaries(version: number): Promise<DictionaryEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/version/${version}/dictionary`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Get all items in a dictionary
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary-item/
   * GET /service/{service_id}/dictionary/{dictionary_id}/items
   */
  async getDictionaryItems(dictionary_id: string): Promise<DictionaryItemEntity[]> {
    try {
      const response = await this.wsClient.get(`service/${this.service_id}/dictionary/${dictionary_id}/items`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Create a new dictionary
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary/
   * POST /service/{service_id}/version/{version_id}/dictionary
   */
  async createDictionary(version: number, name: string, write_only: boolean = false): Promise<DictionaryEntity> {
    try {
      const dto = JSON.stringify({ name, write_only });
      const response = await this.wsClient.post(`service/${this.service_id}/version/${version}/dictionary`, dto);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Update a dictionary
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary/
   * PUT /service/{service_id}/version/{version_id}/dictionary/{dictionary_name}
   */
  async updateDictionary(
    version: number,
    dictionary_name: string,
    new_name: string,
    write_only?: boolean,
  ): Promise<DictionaryEntity> {
    try {
      const dto: { name: string; write_only?: boolean } = { name: new_name };
      if (write_only !== undefined) {
        dto.write_only = write_only;
      }
      const response = await this.wsClient.put(
        `service/${this.service_id}/version/${version}/dictionary/${encodeURIComponent(dictionary_name)}`,
        JSON.stringify(dto),
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Delete a dictionary
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary/
   * DELETE /service/{service_id}/version/{version_id}/dictionary/{dictionary_name}
   */
  async deleteDictionary(version: number, dictionary_name: string): Promise<void> {
    try {
      await this.wsClient.delete(
        `service/${this.service_id}/version/${version}/dictionary/${encodeURIComponent(dictionary_name)}`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Create a dictionary item
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary-item/
   * POST /service/{service_id}/dictionary/{dictionary_id}/item
   */
  async createDictionaryItem(dictionary_id: string, item_key: string, item_value: string): Promise<DictionaryItemEntity> {
    try {
      const dto = JSON.stringify({ item_key, item_value });
      const response = await this.wsClient.post(`service/${this.service_id}/dictionary/${dictionary_id}/item`, dto);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Update a dictionary item
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary-item/
   * PUT /service/{service_id}/dictionary/{dictionary_id}/item/{item_key}
   */
  async updateDictionaryItem(
    dictionary_id: string,
    item_key: string,
    item_value: string,
  ): Promise<DictionaryItemEntity> {
    try {
      const dto = JSON.stringify({ item_value });
      const response = await this.wsClient.put(
        `service/${this.service_id}/dictionary/${dictionary_id}/item/${encodeURIComponent(item_key)}`,
        dto,
      );
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Delete a dictionary item
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary-item/
   * DELETE /service/{service_id}/dictionary/{dictionary_id}/item/{item_key}
   */
  async deleteDictionaryItem(dictionary_id: string, item_key: string): Promise<void> {
    try {
      await this.wsClient.delete(
        `service/${this.service_id}/dictionary/${dictionary_id}/item/${encodeURIComponent(item_key)}`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Upsert a dictionary item (create or update)
   * https://www.fastly.com/documentation/reference/api/dictionaries/dictionary-item/
   * POST /service/{service_id}/dictionary/{dictionary_id}/item (upsert endpoint)
   */
  async upsertDictionaryItem(dictionary_id: string, item_key: string, item_value: string): Promise<DictionaryItemEntity> {
    try {
      const dto = JSON.stringify({ item_key, item_value });
      const response = await this.wsClient.post(`service/${this.service_id}/dictionary/${dictionary_id}/item`, dto);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * Batch update dictionary items (create, update, delete)
   * This method processes an array of items with operation flags
   */
  async updateDictionaryItems(dictionary_id: string, items: DictionaryItemEntity[]): Promise<void> {
    try {
      for (const item of items) {
        if (item.op === 'create') {
          await this.createDictionaryItem(dictionary_id, item.item_key, item.item_value);
        } else if (item.op === 'update') {
          await this.updateDictionaryItem(dictionary_id, item.item_key, item.item_value);
        } else if (item.op === 'delete') {
          await this.deleteDictionaryItem(dictionary_id, item.item_key);
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
