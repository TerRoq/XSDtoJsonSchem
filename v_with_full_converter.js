//before launching, change the paths to yours
//the path should be entered to the xsd file
const fs = require("fs").promises;
const path = require("path");
const xml2js = require("xml2js");

const inputDirectory = "D:\\Users\\Admin\\Desktop\\XSDToJsonSchem\\facts";
const outputDirectory = "D:\\Users\\Admin\\Desktop\\XSDToJsonSchem\\output";

// Преобразование строки в camelCase
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Асинхронное чтение и преобразование XSD в JSON
async function readXsdFile(filePath) {
  try {
    const xsdData = await fs.readFile(filePath, "utf8");
    const jsonResult = await xml2js.parseStringPromise(xsdData, {
      explicitArray: false,
    });
    return jsonResult;
  } catch (err) {
    console.error(`Ошибка при чтении или разборе файла ${filePath}:`, err);
    return null;
  }
}

// Преобразование XSD типа данных в тип JSON Schema
function xsdTypeToJSONSchemaType(xsdType) {
  const typeMap = {
    "xsd:string": "string",
    "xsd:date": "string",
    "xsd:int": "integer",
    "xsd:decimal": "number",
    "xsd:boolean": "boolean",
    "xsd:integer": "integer",
    "xs:string": "string",
    "xs:date": "string",
    "xs:int": "integer",
    "xs:decimal": "number",
    "xs:boolean": "boolean",
    "xs:integer": "integer",
  };
  return typeMap[xsdType] || xsdType;
}

// Функция для обработки complexType с рекурсией для вложенных объектов
function processComplexType(complexType, schemaDefinitions = {}) {
  const schemaObject = {
    type: "object",
    properties: {},
    required: [],
  };

  // Обрабатываем элементы xs:all, xs:sequence, xs:choice и другие
  const processElements = (elements) => {
    elements.forEach((element) => {
      try {
        const elementName = toCamelCase(element.$.name); // Преобразуем имя элемента в camelCase
        const elementType = element.$.type;
        const isComplex = element["xs:complexType"] || element["complexType"]; // Проверка на complexType
        const isSimple = element["xs:simpleType"]; // Проверка на simpleType

        if (isComplex) {
          // Если это complexType, обрабатываем его как объект
          schemaObject.properties[elementName] = processComplexType(
            element["xs:complexType"] || element["complexType"],
            schemaDefinitions
          );
        } else if (isSimple) {
          // Если это simpleType, обрабатываем его
          schemaObject.properties[elementName] = processSimpleType(element["xs:simpleType"]);
        } else if (elementType && schemaDefinitions[elementType]) {
          // Если это тип, определенный в схемах, добавляем как ссылку на схему
          schemaObject.properties[elementName] = schemaDefinitions[elementType];
        } else if (elementType && xsdTypeToJSONSchemaType(elementType)) {
          // Простой элемент с типом
          schemaObject.properties[elementName] = {
            type: xsdTypeToJSONSchemaType(elementType || "string"),
          };
        } else {
          // Если не определен тип, делаем его строкой
          schemaObject.properties[elementName] = { type: "string" };
        }

        // Добавляем в обязательные элементы, если minOccurs > 0
        
        schemaObject.required.push(elementName);
        
      } catch (error) {
        console.warn(`Ошибка обработки элемента: ${JSON.stringify(element)} - ${error.message}`);
      }
    });
  };

  // Обработка simpleType
  const processSimpleType = (simpleType) => {
    const schema = {};

    // Проверяем на ограничения (restriction)
    if (simpleType["xs:restriction"]) {
      const restriction = simpleType["xs:restriction"];
      const baseType = restriction.$.base;
      schema.type = xsdTypeToJSONSchemaType(baseType); // Преобразуем базовый тип в JSON Schema

      // Если есть элементы, такие как enumeration, pattern, length и т.д.
      if (restriction["xs:enumeration"]) {
        const values = Array.isArray(restriction["xs:enumeration"]) 
          ? restriction["xs:enumeration"].map(item => item.$.value)
          : [restriction["xs:enumeration"].$.value];
        schema.enum = values;
      }

      if (restriction["xs:pattern"]) {
        schema.pattern = restriction["xs:pattern"].$.value;
      }

      if (restriction["xs:length"]) {
        schema.minLength = parseInt(restriction["xs:length"].$.value, 10);
        schema.maxLength = parseInt(restriction["xs:length"].$.value, 10);
      }
    }

    return schema;
  };

  // Обрабатываем блоки, такие как xs:all, xs:sequence, xs:choice
  function processComplexBlock(block, type, schemaObject) {
    if (block[type]) {
      if (complexType.$.name === "address_gar"){
        console.log(complexType);
      }
      const elements = Array.isArray(block[type]) ? block[type] : [block[type]];
      elements.forEach((element) => {
        try {
          processElement(element, schemaObject);
        } catch (error) {
          console.warn(`Ошибка обработки блока ${type}: ${error.message}`);
        }
      });
    }
  }

  // Обработка блока xs:all
  const processAll = (allBlock) => {
    if (allBlock && allBlock["xs:element"]) {
      const elements = Array.isArray(allBlock["xs:element"]) ? allBlock["xs:element"] : [allBlock["xs:element"]];
      processElements(elements);
    }

    if (allBlock && allBlock["xs:complexType"]) {
      const complexTypes = Array.isArray(allBlock["xs:complexType"]) ? allBlock["xs:complexType"] : [allBlock["xs:complexType"]];
      complexTypes.forEach(element => {
        if (element.$.name) {
          schemaObject.properties[toCamelCase(element.$.name)] = processComplexType(element, schemaDefinitions); // Преобразуем имя в camelCase
        }
      });
    }
  };

  // Обработка блока xs:choice
  const processChoice = (choiceBlock) => {
    if (choiceBlock && choiceBlock["xs:complexType"]) {
      const complexTypes = Array.isArray(choiceBlock["xs:complexType"]) ? choiceBlock["xs:complexType"] : [choiceBlock["xs:complexType"]];
      complexTypes.forEach(element => {
        if (element.$.name) {
          schemaObject.properties[toCamelCase(element.$.name)] = processComplexType(element, schemaDefinitions); // Преобразуем имя в camelCase
        }
      });
    }
  };
  // Обработка блока xs:sequence
  const processSequence = (SequenceBlock) => {
    if (SequenceBlock && SequenceBlock["xs:element"]) {
      const elements = Array.isArray(SequenceBlock["xs:element"]) ? SequenceBlock["xs:element"] : [SequenceBlock["xs:element"]];
      processElements(elements);
    }

    if (SequenceBlock && SequenceBlock["xs:complexType"]) {
      const complexTypes = Array.isArray(SequenceBlock["xs:complexType"]) ? SequenceBlock["xs:complexType"] : [SequenceBlock["xs:complexType"]];
      complexTypes.forEach(element => {
        if (element.$.name) {
          schemaObject.properties[toCamelCase(element.$.name)] = processComplexType(element, schemaDefinitions); // Преобразуем имя в camelCase
        }
      });
    }
  };

  
  



  // Обрабатываем различные типы XSD структуры в определенном порядке
  if (complexType["xs:sequence"]) {
    
    
    processSequence(complexType["xs:sequence"]);

  }
  if (complexType["xs:all"]) {
    
    processAll(complexType["xs:all"]);
  }
  if (complexType["xs:choice"]) {
    processChoice(complexType["xs:choice"]);
  }
  if (complexType["xs:element"]) {
    processComplexBlock(complexType, "xs:element");
  }

  // Возвращаем результат
  return schemaObject;
}



function convertToJSONSchema(xsdJson) {
  if (!xsdJson["xs:schema"] && !xsdJson["schema"]) {
    console.error("Ошибка: xs:schema или schema не найден в XSD.");
    return null;
  }

  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {},
  };

  let complexTypes =
    xsdJson["xs:schema"]?.["xs:complexType"] ||
    xsdJson["schema"]?.["complexType"] ||
    [];
  if (!Array.isArray(complexTypes)) {
    complexTypes = [complexTypes];
  }

  // Сохраняем все complexType в definitions
  complexTypes.forEach((complexType) => {
    const typeName = complexType.$.name;
    schema.properties[toCamelCase(typeName)] = processComplexType(
      complexType,
      schema.properties
    ); // Преобразуем имя типа в camelCase
  });

  // Корневые элементы должны быть из xs:element
  let rootElements =
    xsdJson["xs:schema"]?.["xs:element"] ||
    xsdJson["schema"]?.["element"] ||
    [];

  if (!Array.isArray(rootElements)) {
    rootElements = [rootElements];
  }

  rootElements.forEach((element) => {
    const elementName = toCamelCase(element.$.name);
    const elementType =
        element.$.type ||
        element["xs:complexType"]?.$.name ||
        element["complexType"]?.$.name;

    if (elementType && schema.properties[elementType]) {
        schema.properties[elementName] = schema.properties[elementType];
    } else if (element["xs:complexType"] || element["complexType"]) {
        schema.properties[elementName] = processComplexType(
            element["xs:complexType"] || element["complexType"],
            schema.properties
        );
    } else {
        console.warn(
            `Элемент ${elementName} не содержит complexType и не ссылается на существующий тип.`
        );
    }

    // Добавляем корневой элемент в required
    if (!schema.required) {
        schema.required = [];
    }
    schema.required.push(elementName); // Добавляем только имя корневого элемента
});


  return schema;
}



// Асинхронная обработка XSD файлов
async function processXsdFilesInDirectory(inputDir, outputDir) {
  try {
    await fs.mkdir(outputDir, { recursive: true });
    const files = await fs.readdir(inputDir);

    for (const file of files) {
      const filePath = path.join(inputDir, file);
      if (path.extname(file) === ".xsd") {
        const xsdJson = await readXsdFile(filePath);
        if (!xsdJson) continue;

        const jsonSchema = convertToJSONSchema(xsdJson);
        if (jsonSchema) {
          const outputFileName = path.basename(file, ".xsd") + ".json";
          const outputFilePath = path.join(outputDir, outputFileName);
          await fs.writeFile(outputFilePath, JSON.stringify(jsonSchema, null, 4));
          console.log(`JSON Schema успешно создан: ${outputFilePath}`);
        }
      }
    }
  } catch (error) {
    console.error("Произошла ошибка:", error);
  }
}

// Запуск обработки
processXsdFilesInDirectory(inputDirectory, outputDirectory);
