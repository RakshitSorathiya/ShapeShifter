import { Property } from './Property';

export class IdProperty extends Property<string> {

  static sanitize(value = '') {
    return value
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  }

  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    super.setEditableValue(model, propertyName, IdProperty.sanitize(value));
  }
}
