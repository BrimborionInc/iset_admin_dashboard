export function generateNunjucksFromComponents(components) {
  return components
    .map((component) => {
      let template = component.nunjucks_template || '';
      let props = { ...(component.props || {}) };

      // Flatten nested props.props into the parent props
      if (props.props && typeof props.props === 'object') {
        props = { ...props, ...props.props };
        delete props.props; // Remove the nested props object
      }

      // Flatten props to handle nested properties
      const flattenProps = (obj, prefix = '') =>
        Object.entries(obj).reduce((acc, [key, value]) => {
          const path = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(acc, flattenProps(value, path));
          } else {
            acc[path] = value;
          }
          return acc;
        }, {});

      const flatProps = flattenProps(props);

      // Replace props.key with corresponding values in the template
      for (const [key, value] of Object.entries(flatProps)) {
        const pattern = new RegExp(`props\\.${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        let stringified;

        if (value === undefined || value === null) {
          stringified = ''; // Replace undefined or null with an empty string
        } else if (typeof value === 'string') {
          stringified = `"${value}"`;
        } else if (Array.isArray(value) || typeof value === 'object') {
          stringified = JSON.stringify(value, null, 2);
        } else {
          stringified = String(value);
        }

        template = template.replace(pattern, stringified);
      }

      // Remove trailing commas before closing braces/brackets
      template = template.replace(/,\s*([}\]])/g, '$1');

      return template;
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function generateRemoteStaticNunjucksFromComponents(components) {
  const apiUrl = process.env.REACT_APP_API_BASE_URL + '/api/generate-static-njk-template';
  try {
    console.log('Payload sent to /api/generate-static-njk-template:', JSON.stringify({ components }, null, 2)); // Log the payload
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ components })
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.text();
    return result;
  } catch (error) {
    return '';
  }
}
