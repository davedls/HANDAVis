document.addEventListener('DOMContentLoaded', function () {
  const regRegion = document.getElementById('regRegion');
  const regMunicipality = document.getElementById('regMunicipality');
  const regBarangay = document.getElementById('regBarangay');

  if (!regRegion || !regMunicipality || !regBarangay) {
    return;
  }

  function setDisabledVisual(select, disabled) {
    select.disabled = disabled;
    select.style.opacity = disabled ? '0.5' : '1';
    select.style.pointerEvents = disabled ? 'none' : 'auto';
  }

  function ensureDropdownBelow(select) {
    const rect = select.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownGrown = 260;
    if (rect.bottom + dropdownGrown > viewportHeight) {
      const scrollAmount = rect.bottom + dropdownGrown - viewportHeight + 16;
      window.scrollBy({ top: scrollAmount, left: 0, behavior: 'smooth' });
    }
  }

  function setOptions(select, options, placeholder) {
    select.innerHTML = '';
    const base = document.createElement('option');
    base.value = '';
    base.textContent = placeholder;
    select.appendChild(base);

    options.forEach(option => {
      const element = document.createElement('option');
      element.value = option;
      element.textContent = option;
      select.appendChild(element);
    });

    select.value = '';
  }

  async function fetchOptions(url) {
    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error('Request failed.');
    }

    const payload = await response.json();
    return payload.data || [];
  }

  regRegion.addEventListener('focus', () => ensureDropdownBelow(regRegion));
  regMunicipality.addEventListener('focus', () => ensureDropdownBelow(regMunicipality));
  regBarangay.addEventListener('focus', () => ensureDropdownBelow(regBarangay));

  regRegion.addEventListener('change', async () => {
    const province = regRegion.value;

    setOptions(regBarangay, [], 'Select Barangay');
    setDisabledVisual(regBarangay, true);

    if (!province) {
      setOptions(regMunicipality, [], 'Select Municipality');
      setDisabledVisual(regMunicipality, true);
      return;
    }

    try {
      const municipalities = await fetchOptions(
        `database/location_options.php?type=municipalities&province=${encodeURIComponent(province)}`
      );
      setOptions(regMunicipality, municipalities, 'Select Municipality');
      setDisabledVisual(regMunicipality, municipalities.length === 0);
    } catch (error) {
      setOptions(regMunicipality, [], 'Select Municipality');
      setDisabledVisual(regMunicipality, true);
    }
  });

  regMunicipality.addEventListener('change', async () => {
    const province = regRegion.value;
    const municipality = regMunicipality.value;

    if (!province || !municipality) {
      setOptions(regBarangay, [], 'Select Barangay');
      setDisabledVisual(regBarangay, true);
      return;
    }

    try {
      const barangays = await fetchOptions(
        `database/location_options.php?type=barangays&province=${encodeURIComponent(province)}&municipality=${encodeURIComponent(municipality)}`
      );
      setOptions(regBarangay, barangays, 'Select Barangay');
      setDisabledVisual(regBarangay, barangays.length === 0);
    } catch (error) {
      setOptions(regBarangay, [], 'Select Barangay');
      setDisabledVisual(regBarangay, true);
    }
  });

  setDisabledVisual(regMunicipality, true);
  setDisabledVisual(regBarangay, true);
});
