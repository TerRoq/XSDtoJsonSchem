# this is the program that connects your xsd into one
# before starting it, you need to change the path to the main xsd file
import os
import xml.etree.ElementTree as ET

namespaces = {'xsd': 'http://www.w3.org/2001/XMLSchema'}
unnamed_counter = 1  # Счётчик для генерации уникальных имен

def indent(elem, level=0):
    """ Добавляем отступы для элемента XML """
    i = "\n" + level * "    "  # Генерируем отступы (4 пробела)
    if len(elem):  # Если элемент имеет дочерние элементы
        if not elem.text or not elem.text.strip():
            elem.text = i + "    "  # Добавляем отступы для текста элемента
        if not elem.tail or not elem.tail.strip():
            elem.tail = i  # Добавляем отступы после тега элемента
        for child in elem:
            indent(child, level + 1)  # Рекурсивно добавляем отступы к дочерним элементам
        if not elem.tail or not elem.tail.strip():
            elem.tail = i
    else:
        if level and (not elem.tail or not elem.tail.strip()):
            elem.tail = i  # Добавляем отступы для замыкающих тегов

def load_xsd_and_resolve_dependencies(file_path, base_dir, processed_files=None, resolved_types=None):
    global unnamed_counter
    if processed_files is None:
        processed_files = set()
    if resolved_types is None:
        resolved_types = {}

    # Избегаем циклических ссылок на файлы
    if file_path in processed_files:
        return resolved_types

    processed_files.add(file_path)

    try:
        tree = ET.parse(file_path)
    except ET.ParseError as e:
        print(f"Ошибка разбора файла {file_path}: {e}")
        return resolved_types

    root = tree.getroot()
    includes = []

    # Обрабатываем <xs:include> и загружаем зависимые файлы
    for elem in root:
        schema_location = elem.attrib.get('schemaLocation')
        if schema_location:
            dependency_file = os.path.join(base_dir, schema_location)
            includes.append((elem, dependency_file))
            resolved_types = load_xsd_and_resolve_dependencies(dependency_file, base_dir, processed_files, resolved_types)

    # Вставляем содержимое дочерних файлов в соответствующие места
    for include_elem, dependency_file in includes:
        try:
            dep_tree = ET.parse(dependency_file)
            dep_root = dep_tree.getroot()

            # Переносим все элементы из дочернего файла
            for dep_elem in dep_root:
                if dep_elem.tag.endswith('element') or dep_elem.tag.endswith('complexType') or dep_elem.tag.endswith('simpleType'):
                    root.insert(list(root).index(include_elem), dep_elem)

            root.remove(include_elem)
        except ET.ParseError as e:
            print(f"Ошибка разбора файла {dependency_file}: {e}")

    # Сохраняем complexType и simpleType для дальнейшего разрешения типов
    for elem in root:
        if elem.tag.endswith('complexType') or elem.tag.endswith('simpleType'):
            type_name = elem.attrib.get('name')
            if not type_name:
                # Если имя отсутствует, генерируем уникальное имя
                type_name = f"UnnamedType_{unnamed_counter}"
                elem.set('name', type_name)
                unnamed_counter += 1
            resolved_types[type_name] = elem

    return resolved_types

# Функция для разрешения ссылок на типы и замены <xs:element> на <xs:complexType> или <xs:simpleType>
def resolve_type_references(tree, resolved_types):
    def replace_type_reference(elem):
        if 'type' in elem.attrib:
            type_name = elem.attrib['type']
            if type_name in resolved_types:
                type_definition = resolved_types[type_name]
                elem_name = elem.attrib.get('name')  # Сохраняем имя элемента
                elem.clear()  # Очищаем элемент, чтобы вставить содержимое типа

                # Преобразуем его в тот же тип, что и в определении (complexType или simpleType)
                elem.tag = type_definition.tag
                if elem_name:
                    elem.set('name', elem_name)

                # Копируем все дочерние элементы из определения типа в элемент
                for child in list(type_definition):
                    elem.append(child)

    for elem in tree.iter():
        if elem.tag.endswith('element'):
            replace_type_reference(elem)

# Модернизированная функция для работы с <xs:include> и вложениями
def load_xsd_and_resolve_dependencies(file_path, base_dir, processed_files=None, resolved_types=None):
    global unnamed_counter
    if processed_files is None:
        processed_files = set()
    if resolved_types is None:
        resolved_types = {}

    # Избегаем циклических ссылок на файлы
    if file_path in processed_files:
        return resolved_types

    processed_files.add(file_path)

    try:
        tree = ET.parse(file_path)
    except ET.ParseError as e:
        print(f"Ошибка разбора файла {file_path}: {e}")
        return resolved_types

    root = tree.getroot()
    includes = []

    # Обрабатываем <xs:include> и загружаем зависимые файлы
    for elem in root:
        schema_location = elem.attrib.get('schemaLocation')
        if schema_location:
            dependency_file = os.path.join(base_dir, schema_location)
            includes.append((elem, dependency_file))
            resolved_types = load_xsd_and_resolve_dependencies(dependency_file, base_dir, processed_files, resolved_types)

    # Вставляем содержимое дочерних файлов в соответствующие места
    for include_elem, dependency_file in includes:
        try:
            dep_tree = ET.parse(dependency_file)
            dep_root = dep_tree.getroot()

            # Переносим все элементы из дочернего файла
            for dep_elem in dep_root:
                if dep_elem.tag.endswith('element') or dep_elem.tag.endswith('complexType') or dep_elem.tag.endswith('simpleType'):
                    root.insert(list(root).index(include_elem), dep_elem)

            root.remove(include_elem)
        except ET.ParseError as e:
            print(f"Ошибка разбора файла {dependency_file}: {e}")

    # Сохраняем complexType и simpleType для дальнейшего разрешения типов
    for elem in root:
        if elem.tag.endswith('complexType') or elem.tag.endswith('simpleType'):
            type_name = elem.attrib.get('name')
            if not type_name:
                # Если имя отсутствует, генерируем уникальное имя
                type_name = f"UnnamedType_{unnamed_counter}"
                elem.set('name', type_name)
                unnamed_counter += 1
            resolved_types[type_name] = elem

    return resolved_types

# Главная часть
if __name__ == "__main__":
    # Setting the path to the main XSD file
    xsd_file_path = "D:\\Users\\Admin\\Desktop\\XSDToJsonSchem\\extract\\extract_cadastral_value_property_v02.xsd"
    base_dir = os.path.dirname(xsd_file_path)

    # Загружаем зависимости и разрешаем типы
    resolved_types = load_xsd_and_resolve_dependencies(xsd_file_path, base_dir)

    # Загружаем исходное дерево XSD
    tree = ET.parse(xsd_file_path)
    root = tree.getroot()

    # Удаляем все <xs:include> элементы после обработки
    for elem in root.findall(".//xsd:include", namespaces):
        root.remove(elem)

    # Разрешаем ссылки на типы
    resolve_type_references(tree, resolved_types)

    # Проверка и исправление структуры
    for elem in root.findall(".//xsd:complexType", namespaces):  # Добавлено пространство имен
        # Проверяем, находятся ли complexType внутри xs:all
        parent = elem.find("..")
        if parent is not None and parent.tag.endswith('all'):
            print(f"Ошибка: <xs:complexType> '{elem.attrib.get('name')}' не должен находиться внутри <xs:all>")
            # Переместим complexType вне xs:all
            root.append(elem)  # Перемещаем complexType на уровень выше
            parent.remove(elem)

    # Сохраняем результат
    indent(root)
    output_file_path = "resolved_full_schema.xsd"
    tree.write(output_file_path, encoding='utf-8', xml_declaration=True)

    print(f"Resolved schema saved to {output_file_path}")
