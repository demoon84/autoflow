import { createTheme } from "@mui/material/styles";

export const desktopTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f6f8fb",
      paper: "#ffffff"
    },
    primary: {
      main: "#00796b",
      light: "#4db6ac",
      dark: "#00574b",
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#607d8b",
      light: "#edf3f6",
      dark: "#455a64",
      contrastText: "#ffffff"
    },
    success: {
      main: "#2e7d32"
    },
    warning: {
      main: "#ed8f03"
    },
    info: {
      main: "#2563eb"
    },
    error: {
      main: "#c24135",
      contrastText: "#ffffff"
    },
    text: {
      primary: "#1f2933",
      secondary: "#64727d"
    },
    divider: "#d8e0e6"
  },
  shape: {
    borderRadius: 10
  },
  typography: {
    fontFamily:
      '"Pretendard Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", "Helvetica Neue", Arial, sans-serif',
    fontSize: 13,
    h1: {
      fontSize: "1.375rem",
      lineHeight: 1.12
    },
    h2: {
      fontSize: "1.125rem",
      lineHeight: 1.18
    },
    h3: {
      fontSize: "1rem",
      lineHeight: 1.2
    },
    h4: {
      fontSize: "0.9375rem",
      lineHeight: 1.25
    },
    h5: {
      fontSize: "0.875rem",
      lineHeight: 1.3
    },
    h6: {
      fontSize: "0.8125rem",
      lineHeight: 1.35
    },
    subtitle1: {
      fontSize: "0.875rem",
      lineHeight: 1.35
    },
    subtitle2: {
      fontSize: "0.8125rem",
      lineHeight: 1.35
    },
    body1: {
      fontSize: "0.8125rem",
      lineHeight: 1.45
    },
    body2: {
      fontSize: "0.75rem",
      lineHeight: 1.4
    },
    button: {
      fontSize: "0.75rem",
      lineHeight: 1.25,
      textTransform: "none",
      letterSpacing: 0
    },
    caption: {
      fontSize: "0.6875rem",
      lineHeight: 1.35
    },
    overline: {
      fontSize: "0.6875rem",
      lineHeight: 1.35
    },
    allVariants: {
      letterSpacing: 0
    }
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: false
      },
      styleOverrides: {
        root: {
          minWidth: 0,
          borderRadius: 10,
          fontSize: "0.75rem",
          fontWeight: 700,
          boxShadow: "none",
          "&.MuiButton-containedSecondary": {
            boxShadow: "none"
          }
        },
        contained: {
          boxShadow: "0 8px 18px rgba(0, 121, 107, 0.20)"
        },
        outlined: {
          borderColor: "#c9d4dc"
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontSize: "0.71875rem",
          fontWeight: 700
        },
        filled: {
          boxShadow: "inset 0 0 0 1px rgba(31, 41, 51, 0.04)"
        }
      }
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f6f8fb",
          scrollbarColor: "#b6c4cc transparent"
        },
        "*::-webkit-scrollbar": {
          width: 10,
          height: 10
        },
        "*::-webkit-scrollbar-thumb": {
          border: "2px solid transparent",
          borderRadius: 999,
          backgroundClip: "content-box",
          backgroundColor: "#b6c4cc"
        },
        "*::-webkit-scrollbar-thumb:hover": {
          backgroundColor: "#8fa3ae"
        },
        "*::-webkit-scrollbar-track": {
          backgroundColor: "transparent"
        }
      }
    },
    MuiCard: {
      defaultProps: {
        elevation: 0
      },
      styleOverrides: {
        root: {
          border: "1px solid #d8e0e6",
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(31, 41, 51, 0.06), 0 1px 3px rgba(31, 41, 51, 0.08)"
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: "1px solid #d8e0e6",
          borderRadius: 18,
          boxShadow: "0 28px 80px rgba(31, 41, 51, 0.26)"
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          color: "#64727d",
          "&:hover": {
            backgroundColor: "rgba(0, 121, 107, 0.08)",
            color: "#00796b"
          }
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: "0.75rem",
          margin: "2px 6px",
          minHeight: 34,
          "&.Mui-selected": {
            backgroundColor: "rgba(0, 121, 107, 0.12)"
          },
          "&.Mui-selected:hover": {
            backgroundColor: "rgba(0, 121, 107, 0.18)"
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#ffffff",
          fontSize: "0.8125rem",
          transition: "box-shadow 140ms ease, border-color 140ms ease",
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#a8bac4"
          },
          "&.Mui-focused": {
            boxShadow: "0 0 0 3px rgba(0, 121, 107, 0.13)"
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00796b",
            borderWidth: 1
          }
        },
        notchedOutline: {
          borderColor: "#c9d4dc"
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 34,
          padding: "7px 14px",
          borderRadius: 8,
          color: "#64727d",
          fontWeight: 700,
          textTransform: "none",
          "&.Mui-selected": {
            color: "#00574b",
            backgroundColor: "#ffffff",
            boxShadow: "0 4px 14px rgba(31, 41, 51, 0.08)"
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40
        },
        indicator: {
          display: "none"
        }
      }
    }
  }
});
