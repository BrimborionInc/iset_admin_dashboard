UPDATE iset_case c
JOIN client cl ON cl.id = c.client_id
JOIN canada_region r
  ON r.code = UPPER(
    COALESCE(
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')),
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province_code')),
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.provinceCode')),
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province')),
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province_code')),
      JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.provinceCode'))
    )
  )
SET c.portfolio_region_id = r.region_id
WHERE c.portfolio_region_id IS NULL;
