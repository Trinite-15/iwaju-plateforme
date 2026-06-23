export const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const isValidCode = (code) => {
  return /^[A-Z0-9]{6}$/.test(code);
};

export const formatCode = (code) => {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

export default generateCode;