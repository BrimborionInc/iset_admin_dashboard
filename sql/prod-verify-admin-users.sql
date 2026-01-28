SELECT sp.email, sp.primary_role, sp.region_id
FROM staff_profiles sp
WHERE sp.email IN (
  'sstacey@nwac.ca','mcoppola@nwac.ca','acurtis@nwac.ca','emarion@nwac.ca','lkuzma@nwac.ca',
  'k.hyde@keepersofthecircle.com','iset@mmvi.ca','sewasiuk@iaaw.ca','isets@nativewomens.com'
)
ORDER BY sp.email;

SELECT sp.email, COALESCE(GROUP_CONCAT(cr.code ORDER BY cr.code SEPARATOR ','),'') AS regions
FROM staff_profiles sp
LEFT JOIN staff_region sr ON sr.staff_profile_id = sp.id
LEFT JOIN canada_region cr ON cr.region_id = sr.region_id
WHERE sp.email IN (
  'sstacey@nwac.ca','mcoppola@nwac.ca','acurtis@nwac.ca','emarion@nwac.ca','lkuzma@nwac.ca',
  'k.hyde@keepersofthecircle.com','iset@mmvi.ca','sewasiuk@iaaw.ca','isets@nativewomens.com'
)
GROUP BY sp.email
ORDER BY sp.email;
